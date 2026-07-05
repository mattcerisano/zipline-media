import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { Job, JobShot, JobSchedule, JobRole, JobLink } from '@/components/gearbuilder/types';
import { getBranding, hexToRgb } from '@/lib/branding';
import { caps } from '@/lib/format';
import { fetchGearCategoryMap, groupManifestByCategory, buildGearTableBody } from '@/lib/gear-manifest';

// Neutral text colors (not brand-specific)
const TEXT_DARK = '#111111';
const TEXT_GRAY = '#666666';

// Helper to load remote image as base64
async function getBase64ImageFromUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/*'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn(`CORS or connection issue when fetching image for PDF: ${url}`, err);
    return null; // Graceful fallback
  }
}

export async function generateMasterBrief(jobId: string): Promise<void> {
  try {
    console.log(`[PDF Generator] Starting Master Production Brief export for Job: ${jobId}`);

    // 1. Fetch Job main details
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      throw new Error(`Job not found: ${jobErr?.message || ''}`);
    }

    // Load organization branding (logo, color, name) for the export.
    const branding = await getBranding();
    const [br, bg, bb] = hexToRgb(branding.brand_color);
    const brandLogo = branding.logo_url ? await getBase64ImageFromUrl(branding.logo_url) : null;

    // 2. Fetch Crew roles
    const { data: rolesData, error: rolesErr } = await supabase
      .from('job_roles')
      .select('*, contact:contacts(*)')
      .eq('job_id', jobId);

    const roles: JobRole[] = rolesData || [];

    // 3. Fetch Schedule
    const { data: scheduleData, error: schedErr } = await supabase
      .from('job_schedules')
      .select('*')
      .eq('job_id', jobId)
      .order('sort_order', { ascending: true });

    const schedules: JobSchedule[] = scheduleData || [];

    // 4. Fetch Shotlist
    const { data: shotData, error: shotErr } = await supabase
      .from('job_shotlist')
      .select('*')
      .eq('job_id', jobId)
      .order('sort_order', { ascending: true });

    const shotlist: JobShot[] = shotData || [];

    // 5. Gear manifest, grouped by inventory category — shares the exact
    // grouping/ordering used by the Call Sheet export so both PDFs match.
    const manifestObj = (job.gear_manifest || {}) as Record<string, number>;
    const hasGear = Object.values(manifestObj).some(count => count > 0);
    const gearGroups = hasGear
      ? groupManifestByCategory(manifestObj, await fetchGearCategoryMap())
      : [];

    // Pre-compute the creative page content so the page is skipped entirely
    // when the creative board was never filled out (no more blank pages).
    let creativeBriefText = '';
    if (job.creative_brief) {
      creativeBriefText = job.creative_brief;
      try {
        if (job.creative_brief.trim().startsWith('{')) {
          const parsed = JSON.parse(job.creative_brief);
          let assembled = '';
          if (parsed.concept) assembled += `CORE CONCEPT & THEME:\n${parsed.concept}\n\n`;
          if (parsed.lighting) assembled += `LIGHTING & COLOR DIRECTION:\n${parsed.lighting}\n\n`;
          if (parsed.camera) assembled += `CAMERA & MOVEMENT STYLE:\n${parsed.camera}\n\n`;
          if (parsed.audio) assembled += `AUDIO & SOUNDSCAPE VIBE:\n${parsed.audio}\n\n`;
          creativeBriefText = assembled.trim();
        }
      } catch {
        creativeBriefText = job.creative_brief;
      }
      creativeBriefText = creativeBriefText.trim();
    }
    const colors = (job.color_palette || []) as string[];
    const creativeLinks = ((job.links as JobLink[]) || []).filter(
      (l: JobLink) => l.category === 'Creative' || l.category === 'Other'
    );
    const hasCreativeContent = !!creativeBriefText || colors.length > 0 || creativeLinks.length > 0;

    // Initialize PDF Document
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;

    // Helper to draw Header Branding
    const drawBrandingHeader = (titleLabel: string) => {
      // Branding Bar
      doc.setFillColor(br, bg, bb);
      doc.rect(0, 0, pageWidth, 8, 'F');

      // Right Header: logo image if available, otherwise the company name text
      if (brandLogo) {
        try {
          const logoH = 26;
          const logoW = 78; // fits typical landscape logos; jsPDF scales to box
          doc.addImage(brandLogo, 'PNG', pageWidth - margin - logoW, 22, logoW, logoH, undefined, 'FAST');
        } catch {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(br, bg, bb);
          doc.text(branding.name.toUpperCase(), pageWidth - margin, 32, { align: 'right' });
        }
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(br, bg, bb);
        doc.text(branding.name.toUpperCase(), pageWidth - margin, 32, { align: 'right' });

        if (branding.tagline) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6);
          doc.setTextColor(102, 102, 102);
          doc.text(branding.tagline.toUpperCase(), pageWidth - margin, 40, { align: 'right' });
        }
      }

      // Left Header Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(17, 17, 17);
      doc.text(job.title.toUpperCase(), margin, 45);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(102, 102, 102);
      doc.text(titleLabel.toUpperCase(), margin, 57);

      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.5);
      doc.line(margin, 65, pageWidth - margin, 65);
    };

    // Helper to draw Footer page numbering. Stamped once at the very end so
    // page numbers stay correct no matter which sections were skipped.
    const drawFooter = (pageNum: number, totalPages: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
      doc.text(`${branding.name.toUpperCase()} • INTERNAL PRODUCTION BRIEF`, margin, pageHeight - 20);
    };

    // ==========================================
    // PAGE: PRODUCTION LOGISTICS & CALL SHEET
    // ==========================================
    drawBrandingHeader("Logistics & Production Call Sheet");
    
    // Shoot Date Header
    const formattedDate = job.shoot_date 
      ? new Date(job.shoot_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) 
      : 'TBD';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(17, 17, 17);
    doc.text(`SHOOT DATE: ${formattedDate.toUpperCase()}`, margin, 85);

    // Logistics info grid table
    autoTable(doc, {
      startY: 95,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 5, lineColor: [220, 220, 220], lineWidth: 0.5, textColor: TEXT_DARK },
      columnStyles: {
        0: { cellWidth: 90, fontStyle: 'bold', fillColor: [245, 245, 245] },
        1: { cellWidth: 170 },
        2: { cellWidth: 90, fontStyle: 'bold', fillColor: [245, 245, 245] },
        3: { cellWidth: 'auto' },
      },
      body: [
        ['CALL TIME:', caps(job.call_time, 'TBD'), 'WEATHER:', caps(job.weather_summary, 'TBD')],
        ['LOCATION:', caps(job.location_name, 'TBD'), 'HOSPITAL:', caps(job.nearest_hospital_name, 'TBD')],
        ['ADDRESS:', caps(job.location_address, '—'), 'ADDRESS:', caps(job.nearest_hospital_address, '—')],
        ['CLIENT:', caps(job.client_name, '—'), 'PARKING:', caps(job.nearest_parking_name, 'TBD')],
        ['PROD CO:', caps(job.production_company, branding.name.toUpperCase()), 'ADDRESS:', caps(job.nearest_parking_address, '—')],
      ],
      margin: { left: margin, right: margin }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 20;

    // Shoot Schedule Section — only rendered once a schedule actually exists.
    if (schedules.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(br, bg, bb);
      doc.text('SHOOT DAY SCHEDULE', margin, currentY);
      currentY += 8;

      const scheduleRows = schedules.map(s => [
        `${s.start_time}${s.end_time ? ` - ${s.end_time}` : ''}`,
        s.notes
          ? `${s.task.toUpperCase()}\nDETAILS: ${s.notes}`
          : s.task.toUpperCase(),
        s.location ? s.location.toUpperCase() : 'ON SET'
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['TIME', 'ACTIVITY / TASK', 'LOCATION']],
        body: scheduleRows,
        theme: 'grid',
        headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8.5, textColor: TEXT_DARK, cellPadding: 5 },
        columnStyles: {
          0: { cellWidth: 120, fontStyle: 'bold' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 130 }
        },
        margin: { left: margin, right: margin }
      });
      currentY = (doc as any).lastAutoTable.finalY + 20;
    }

    // General Notes
    if (job.notes_general) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(br, bg, bb);
      doc.text('GENERAL LOGISTICAL NOTES', margin, currentY);
      currentY += 8;

      autoTable(doc, {
        startY: currentY,
        theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: 8, fillColor: [250, 250, 250], textColor: TEXT_DARK },
        body: [[job.notes_general]],
        margin: { left: margin, right: margin }
      });
    }

    // ==========================================
    // PAGE: CREW & TALENT DIRECTORY (only when crew is assigned)
    // ==========================================
    if (roles.length > 0) {
      doc.addPage();
      drawBrandingHeader("Crew & Talent Directory");

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(br, bg, bb);
      doc.text('ASSIGNED CREW & ROLES', margin, 85);

      const crewData = roles.map(role => [
        caps(role.position, 'TBD'),
        caps(role.contact?.name || role.name, 'TBD'),
        role.contact?.email || role.email || '—',
        role.contact?.phone || role.phone || '—',
        caps(role.call_time || job.call_time, '—'),
        role.day_rate ? `$${role.day_rate}` : role.flat_fee ? `$${role.flat_fee} (Flat)` : '—'
      ]);

      autoTable(doc, {
        startY: 95,
        head: [['POSITION / ROLE', 'NAME', 'EMAIL', 'PHONE', 'CALL TIME', 'RATE']],
        body: crewData,
        theme: 'grid',
        headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8.5, textColor: TEXT_DARK, cellPadding: 6 },
        columnStyles: {
          0: { cellWidth: 120, fontStyle: 'bold' },
          1: { cellWidth: 100 },
          2: { cellWidth: 130 },
          3: { cellWidth: 90 },
          4: { cellWidth: 60 },
          5: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin, top: 50, bottom: 45 }
      });
    }

    // ==========================================
    // PAGE: EQUIPMENT MANIFEST (only when gear is assigned)
    // Formatted identically to the Call Sheet's gear table.
    // ==========================================
    if (gearGroups.length > 0) {
      doc.addPage();
      drawBrandingHeader("Equipment Manifest");

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(br, bg, bb);
      doc.text('EQUIPMENT MANIFEST', margin, 85);

      autoTable(doc, {
        startY: 95,
        head: [['QTY', 'ITEM']],
        body: buildGearTableBody(gearGroups),
        theme: 'grid',
        headStyles: { fillColor: [br, bg, bb], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 9, textColor: TEXT_DARK, cellPadding: 5 },
        columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold', halign: 'center' }, 1: { cellWidth: 'auto' } },
        margin: { left: margin, right: margin, top: 50, bottom: 45 }
      });
    }

    // ==========================================
    // PAGE: CREATIVE BRIEF & COLOR PALETTE (only when the board has content)
    // ==========================================
    if (hasCreativeContent) {
      doc.addPage();
      drawBrandingHeader("Creative Treatment & Style Board");

      let creativeY = 85;

      // Creative Brief Text
      if (creativeBriefText) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(br, bg, bb);
        doc.text('CREATIVE DIRECTION BRIEF', margin, creativeY);
        creativeY += 10;

        const splitBrief = doc.splitTextToSize(creativeBriefText, pageWidth - (margin * 2));
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(TEXT_DARK);
        doc.text(splitBrief, margin, creativeY);
        creativeY += (splitBrief.length * 13) + 25;
      }

      // Color Palette Swatches
      if (colors.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(br, bg, bb);
        doc.text('PRODUCTION STYLE & COLOR PALETTE', margin, creativeY);
        creativeY += 10;

        const swatchWidth = 60;
        const swatchHeight = 40;
        const swatchSpacing = 20;
        let startX = margin;

        colors.forEach((colorHex: string) => {
          try {
            const [r, g, b] = hexToRgb(colorHex);
            doc.setFillColor(r, g, b);
            doc.rect(startX, creativeY, swatchWidth, swatchHeight, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(TEXT_DARK);
            doc.text(colorHex.toUpperCase(), startX + (swatchWidth / 2), creativeY + swatchHeight + 12, { align: 'center' });

            startX += swatchWidth + swatchSpacing;
          } catch (e) {
            console.warn(`Invalid color format: ${colorHex}`);
          }
        });
        creativeY += swatchHeight + 35;
      }

      // Custom Creative Reference Links
      if (creativeLinks.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(br, bg, bb);
        doc.text('CREATIVE REFERENCES & DECK ATTACHMENTS', margin, creativeY);
        creativeY += 10;

        const linksBody = creativeLinks.map((l: JobLink) => [l.label.toUpperCase(), l.url]);
        autoTable(doc, {
          startY: creativeY,
          head: [['RESOURCE LABEL', 'ACCESS LINK URL']],
          body: linksBody,
          theme: 'grid',
          headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 8, textColor: TEXT_DARK, cellPadding: 5 },
          margin: { left: margin, right: margin, top: 50, bottom: 45 }
        });
      }
    }

    // ==========================================
    // PAGES: SHOTLIST & STORYBOARD REFERENCE (only when shots exist)
    // ==========================================
    if (shotlist.length > 0) {
      doc.addPage();
      drawBrandingHeader("Shotlist & Visual Storyboard");

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(br, bg, bb);
      doc.text('PRODUCTION SHOTLIST', margin, 85);

      let shotY = 95;
      let currentScene = '';

      // Loop shots
      for (let i = 0; i < shotlist.length; i++) {
        const shot = shotlist[i];

        // Draw scene header if it changes
        const sceneName = shot.scene_group || 'Scene 1';
        if (sceneName !== currentScene) {
          currentScene = sceneName;

          if (shotY + 40 > pageHeight - 45) {
            doc.addPage();
            drawBrandingHeader("Shotlist & Visual Storyboard");
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(br, bg, bb);
            doc.text('PRODUCTION SHOTLIST (CONTINUED)', margin, 85);
            shotY = 95;
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(br, bg, bb);
          doc.text(sceneName.toUpperCase(), margin, shotY + 15);

          doc.setDrawColor(br, bg, bb);
          doc.setLineWidth(1);
          doc.line(margin, shotY + 20, pageWidth - margin, shotY + 20);
          shotY += 30;
        }

        // Check if card fits on page, else create new page
        const hasImage = !!shot.image_url;
        const requiredHeight = hasImage ? 150 : 80;

        if (shotY + requiredHeight > pageHeight - 45) {
          doc.addPage();
          drawBrandingHeader("Shotlist & Visual Storyboard");
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(br, bg, bb);
          doc.text('PRODUCTION SHOTLIST (CONTINUED)', margin, 85);
          shotY = 95;
        }

        // Draw Shot Card Box
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(shot.is_special ? 245 : 220, shot.is_special ? 158 : 220, shot.is_special ? 11 : 220); // Gold border if special
        doc.setLineWidth(shot.is_special ? 1.5 : 0.5);
        doc.rect(margin, shotY, pageWidth - (margin * 2), requiredHeight - 10, 'FD');

        // Draw Shot Label / Number (Left)
        doc.setFillColor(shot.is_special ? 254 : 240, shot.is_special ? 243 : 240, shot.is_special ? 199 : 240); // Soft gold fill if special
        doc.rect(margin + 5, shotY + 5, 45, 20, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(shot.is_special ? 180 : 17, shot.is_special ? 83 : 17, shot.is_special ? 9 : 17);
        doc.text(shot.shot_number || `${i + 1}`, margin + 27, shotY + 17, { align: 'center' });

        // Special Shot badge text
        if (shot.is_special) {
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'bold');
          doc.text('KEY SHOT', margin + 27, shotY + 29, { align: 'center' });
        }

        // Text Info (Middle-Left)
        const textX = margin + 60;
        const textWidth = hasImage ? pageWidth - margin - textX - 160 : pageWidth - margin - textX - 15;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text('DESCRIPTION / ACTION:', textX, shotY + 14);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(TEXT_DARK);
        
        const splitDesc = doc.splitTextToSize(shot.description, textWidth);
        doc.text(splitDesc, textX, shotY + 25);

        // Framing & Equipment (Middle-Right)
        const metaX = textX + textWidth + 10;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text('FRAMING / RATIO:', metaX, shotY + 14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(br, bg, bb);
        const framingText = `${shot.framing || '—'} (${shot.aspect_ratio || '16:9'})`.toUpperCase();
        doc.text(framingText, metaX, shotY + 25);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text('EQUIPMENT / LIGHTING:', metaX, shotY + 45);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(TEXT_DARK);
        
        let equipText = (shot.equipment || '—').toUpperCase();
        if (shot.lighting_setup) {
          equipText += ` / LIGHT: ${shot.lighting_setup.toUpperCase()}`;
        }
        
        const splitEquip = doc.splitTextToSize(equipText, hasImage ? 130 : 150);
        doc.text(splitEquip, metaX, shotY + 54);

        // Thumbnail image render (Far Right)
        if (hasImage && shot.image_url) {
          const imgX = pageWidth - margin - 130;
          const imgY = shotY + 8;
          const imgW = 120;
          const imgH = requiredHeight - 26;

          // Attempt loading base64 image
          const base64 = await getBase64ImageFromUrl(shot.image_url);
          if (base64) {
            try {
              // Guess format based on URL or use JPEG
              const format = shot.image_url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
              doc.addImage(base64, format, imgX, imgY, imgW, imgH);
            } catch (err) {
              console.warn("Failed to render loaded base64 in pdf:", err);
              doc.setDrawColor(200, 200, 200);
              doc.rect(imgX, imgY, imgW, imgH);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7);
              doc.setTextColor(TEXT_GRAY);
              doc.text('[Image Render Error]', imgX + (imgW / 2), imgY + (imgH / 2), { align: 'center' });
            }
          } else {
            // Fallback border with clickable link text
            doc.setDrawColor(230, 230, 230);
            doc.rect(imgX, imgY, imgW, imgH);
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(br, bg, bb);
            // jsPDF textWithLink expects 4 arguments. Offset X coordinate to center string inside thumbnail box.
            doc.textWithLink('[View Screenshot 🔗]', imgX + 20, imgY + (imgH / 2), { url: shot.image_url || '' });
          }
        }

        shotY += requiredHeight;
      }
    }

    // Stamp footers last so page numbers reflect only the sections that
    // actually rendered (empty sections are skipped entirely).
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(i, totalPages);
    }

    // Save File
    const fileName = `${job.title.replace(/\s+/g, '_')}_Production_Brief.pdf`;
    doc.save(fileName);
    console.log(`[PDF Generator] Master Brief PDF successfully generated: ${fileName}`);

  } catch (err: any) {
    console.error('Error generating master production brief:', err);
    throw err;
  }
}
