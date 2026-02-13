export interface InventoryItem {
  name: string;
  category: string;
  qty: number;
  replacement: number;
  image?: string;
  owner?: string;
}

export const ALL_CATEGORIES = [
  "Camera",
  "Lens",
  "Lens Accessories",
  "Grip/Support",
  "Lighting",
  "Modifiers",
  "Stands/Grip",
  "Audio",
  "Playback & Wireless Video",
  "Power",
  "Comms",
  "Carts/Cases",
  "Computing",
  "Specialty"
];

export const INVENTORY: InventoryItem[] = [
  // --- CAMERA ---
  {name:"Sony Burano 8K Digital Motion Picture Camera", category:"Camera", qty:1, replacement:25000, image: "/gear/sony_burano.jpg"},
  {name:"Sony FX6", category:"Camera", qty:2, replacement:7799, image: "/gear/fx6.jpg"},
  {name:"Sony FX3", category:"Camera", qty:1, replacement:3698, image: "/gear/fx3.jpg"},
  {name:"Sony A7SIII", category:"Camera", qty:2, replacement:3698, image: "/gear/sony_a7siii.jpg"},
  {name:"Sony A7R II", category:"Camera", qty:1, replacement:1398, image: "/gear/sony_a7r_ii.jpg"},
  {name:"DJI Air 2S Drone", category:"Camera", qty:1, replacement:849, image: "/gear/dji_air_2s.jpg"},
  {name:"Insta360 X5", category:"Camera", qty:1, replacement:550, image: "/gear/insta360_x5.jpg"},
  {name:"GoPro Hero 11", category:"Camera", qty:1, replacement:399, image: "/gear/gopro_hero_11.jpg"},

  // --- LENS ---
  {name:"Sony FE 14mm F1.8 GM", category:"Lens", qty:1, replacement:1598, image: "/gear/sony_fe_14mm_f_18_gm.jpg"},
  {name:"Sony 50mm F1.2 G-Master", category:"Lens", qty:1, replacement:2098, image: "/gear/sony_50mm_f12_g-master.jpg"},
  {name:"Sony FE 70-200mm F2.8 GM OSS II", category:"Lens", qty:2, replacement:2798, image: "/gear/sony_fe_70-200mm_f28_gm_oss_ii.png"},
  {name:"Sigma 14-24mm F2.8", category:"Lens", qty:1, replacement:1399, image: "/gear/sigma_14_24mm_f28.jpg"},
  {name:"Sigma 24-70mm F2.8", category:"Lens", qty:4, replacement:1189, image: "/gear/sigma_24_70mm_f28.jpg"},
  {name:"Sigma 28-105mm F2.8 DG DN", category:"Lens", qty:1, replacement:1499, image: "/gear/sigma_28_105mm_f2_8_dg_dn.jpg"},
  {name:"Sigma 35mm F1.4", category:"Lens", qty:1, replacement:799, image: "/gear/sigma_303969_35mm_f_1_4_dg_dn_1636131.jpg"},
  {name:"Sigma 85mm F1.4 DG DN", category:"Lens", qty:1, replacement:1199, image: "/gear/sigma_85mm_f14.jpg"},
  {name:"Sirui 35mm T2.9 1.6× Full-Frame Anamorphic (Sony E)", category:"Lens", qty:1, replacement:899, image: "/gear/sirui_35mm_t29_16x_full-frame_anamorphic_lens_sony_e.jpg"},
  {name:"Sirui 50mm T2.9 1.6× Anamorphic Full-Frame", category:"Lens", qty:1, replacement:899, image: "/gear/sirui_50mm_t2_9_1_6__anamorphic_full_frame.jpg"},
  {name:"Sirui 75mm T2.9 1.6× Anamorphic Full-Frame", category:"Lens", qty:1, replacement:899, image: "/gear/sirui_75mm_t2_9_1_6__anamorphic_full_frame.jpg"},
  {name:"DZOFILM Vespid Prime Cinema Lens Kit B with 25/35/50/75/100/125mm T2.1, 90mm Macro T2.8", category:"Lens", qty:1, replacement:5600, image: "/gear/dzofilm_vespid_7-lens_kit_b_pl_mount.jpg"},
  {name:"Venus Optics Laowa 9mm F5.6 FF RL (Sony E)", category:"Lens", qty:1, replacement:599, image: "/gear/venus_optics_laowa_9mm_f_56_ff_rl_lens_for_sony_e.jpg"},
  {name:"Rokinon 85mm F1.4 AS IF UMC (Canon EF)", category:"Lens", qty:1, replacement:249, image: "/gear/rokinon_85mm_f_14_as_if_umc_lens_for_canon_ef.jpg"},
  {name:"MIR-1B 37mm F4", category:"Lens", qty:1, replacement:0, image: "/gear/mir-1b_37mm_f4.jpg"},
  {name:"Super-Takumar 50mm F1.2", category:"Lens", qty:1, replacement:150, image: "/gear/super_takmar_50mm_f12.webp"},
  {name:"Helios 44-2 58mm F2", category:"Lens", qty:1, replacement:75, image: "/gear/helios_44-2_58mm_f2.jpg"},
  {name:"Jupiter 11A 135mm F4", category:"Lens", qty:1, replacement:75, image: "/gear/jupiter_11a_135mm_f4.jpg"},

  // --- LENS ACCESSORIES ---
  {name:"Module 8 L1 Tuner Variable Look Lens Attachment (PL-Mount Lens to E-Mount Camera)", category:"Lens Accessories", qty:1, replacement:2499, image: "/gear/module_8_l1_tuner_-_baltar_variable_look_lens_-_pl_lens_to_e_mount.webp"},
  {name:"Sony FE 1.4× Teleconverter", category:"Lens Accessories", qty:1, replacement:548, image: "/gear/sony_fe_14x_teleconverter.jpg"},
  {name:"Sony FE 2.0× Teleconverter", category:"Lens Accessories", qty:1, replacement:548, image: "/gear/sony_fe_20x_teleconverter.webp"},
  {name:"PolarPro Basecamp Matte Box", category:"Lens Accessories", qty:1, replacement:599, image: "/gear/polarpro_basecamp_matte_box.png"},
  {name:"Freewell Standard Day Variable ND  (, 2 to 5-Stop) Filter 82mm", category:"Lens Accessories", qty:1, replacement:329, image: "/gear/freewell_standard_day_variable_nd_____2_to_5_stop__filter_82mm.jpg"},
  {name:"Freewell Standard Day Variable ND  (, 2 to 5-Stop) Filter 77mm", category:"Lens Accessories", qty:1, replacement:299, image: "/gear/freewell_standard_day_variable_nd_____2_to_5_stop__filter_77mm.jpg"},
  {name:"Tiffen 77mm Variable ND", category:"Lens Accessories", qty:1, replacement:199, image: "/gear/tiffen_77mm_variable_nd.jpg"},
  {name:"Tiffen 77mm Circular Polarizer", category:"Lens Accessories", qty:1, replacement:129, image: "/gear/tiffen_77mm_circular_polarizer.jpg"},
  {name:"GOBE ND2-400 ND Filter 82mm", category:"Lens Accessories", qty:1, replacement:89, image: "/gear/gobe_nd2_400_nd_filter_82mm.jpg"},
  {name:"Prism LensFX Kaleidoscope Filter", category:"Lens Accessories", qty:1, replacement:89, image: "/gear/prism_lensfx_kaleidoscope_filter.jpg"},
  {name:"Prism Lens FX Moody Filter 77mm", category:"Lens Accessories", qty:1, replacement:89, image: "/gear/prism_lens_fx_moody_filter_77mm.jpg"},
  {name:"Prism Lens FX Anamorphic Filter 77mm", category:"Lens Accessories", qty:1, replacement:89, image: "/gear/prism_lens_fx_anamorphic_filter_77mm.jpg"},
  {name:"Prism Lens FX Starburst 77mm", category:"Lens Accessories", qty:1, replacement:89, image: "/gear/prism_lens_fx_starburst_77mm.jpg"},
  {name:"Prism Lens FX Radiant FX 77mm", category:"Lens Accessories", qty:1, replacement:89, image: "/gear/prism_lens_fx_radiant_fx_77mm.jpg"},
  {name:"82mm Black Pro-Mist 1/2", category:"Lens Accessories", qty:2, replacement:129, image: "/gear/82mm_black_pro_mist_1_2.jpg"},
  {name:"82mm Black Pro-Mist 1/4", category:"Lens Accessories", qty:1, replacement:129, image: "/gear/82mm_black_pro_mist_1_4.jpg"},
  {name:"77mm Black Pro-Mist 1/2", category:"Lens Accessories", qty:2, replacement:119, image: "/gear/77mm_black_pro_mist_1_2.jpg"},
  {name:"CinePacks Soft Half 77mm", category:"Lens Accessories", qty:2, replacement:79, image: "/gear/cinepacks_soft_half_77mm.jpg"},
  {name:"Star Filter 77mm", category:"Lens Accessories", qty:1, replacement:39, image: "/gear/star_filter_77mm.jpg"},

  // --- LIGHTING ---
  {name:"Aputure LS 600x Pro Bi-Color (V-Mount)", category:"Lighting", qty:1, replacement:1890, image: "/gear/aputure_ls_600x_pro_bi_color__v_mount_.jpg"},
  {name:"Nanlite PavoTube II 30X 4-Light Kit", category:"Lighting", qty:1, replacement:1800, image: "/gear/nanlite_pavotube_ii_30x_rgbww_led_pixel_tube_4-light_kit.jpg"},
  {name:"Nanlite PavoTube II 15X Kit", category:"Lighting", qty:1, replacement:800, image: "/gear/nanlite_pavotube_ii_15x.jpg"},
  {name:"Amaran F22c Flexible LED Panel", category:"Lighting", qty:1, replacement:499, image: "/gear/amaran_f22c.jpg"},
  {name:"Amaran F21c Flexible Light Mat", category:"Lighting", qty:1, replacement:399, image: "/gear/amaran_f21c_2_x_1_rgb_led_flexible_light_mat.jpg"},
  {name:"Amaran 200x", category:"Lighting", qty:1, replacement:349, image: "/gear/amaran_200x.jpg"},
  {name:"Amaran 100x", category:"Lighting", qty:2, replacement:249, image: "/gear/amaran_100x.jpg"},
  {name:"Nanlite PavoBulb 10C Bi-Color RGBWW LED Bulb (4-Light Kit)", category:"Lighting", qty:1, replacement:699, image: "/gear/nanlite_pavobulb_10c_bi_color_rgbww_led_bulb__4_light_kit_.jpg"},
  {name:"Ulanzi UA20 20W Bi-Color Inflatable Tube Light", category:"Lighting", qty:2, replacement:60, image: "/gear/ulanzi_ua20_20w_bi_color_inflatable_tube_light.jpg"},
  {name:"Ulanzi UA12 Bi-Color Inflatable Tube Light", category:"Lighting", qty:5, replacement:36, image: "/gear/ulanzi_ua12_bi_color_inflatable_tube_light.jpg"},
  {name:"Ulanzi UA20C RGB Inflatable Tube Light", category:"Lighting", qty:2, replacement:76, image: "/gear/ulanzi_ua20c_rgb_inflatable_tube_light.jpg"},
  {name:"Aputure MC", category:"Lighting", qty:3, replacement:90, image: "/gear/aputure_mc_lights.jpg"},

  // --- MODIFIERS ---
  {name:"Kupo Butterfly Frame Kit (6×6)", category:"Modifiers", qty:1, replacement:379, image: "/gear/kupo_butterfly_frame_kit_6_x_6.jpg"},
  {name:"Angler 48″ Boombox Octagonal Softbox (Bowens)", category:"Modifiers", qty:2, replacement:279, image: "/gear/angler_boombox_octagonal_softbox_with_bowens_mount.jpg"},
  {name:"Impact PortaFrame 24×36 Scrim-Flag Kit", category:"Modifiers", qty:1, replacement:249, image: "/gear/impact_portaframe_scrim_flag_kit_24_x_36_.jpg"},
  {name:"Glow EZ Lock 12×56″ Softbox", category:"Modifiers", qty:1, replacement:199, image: "/gear/glow_ez_lock_12x56__softbox.jpg"},
  {name:"Glow EZ Lock Deep Parabolic Softbox (28″)", category:"Modifiers", qty:1, replacement:119, image: "/gear/glow_ez_lock_deep_parabolic_quick_softbox_28_.jpg"},
  {name:"Aputure Lantern Softbox", category:"Modifiers", qty:1, replacement:119, image: "/gear/aputure_lantern_softbox.jpg"},

  // --- GRIP / SUPPORT ---
  {name:"Steadicam Aero 30 Stabilizer System", category:"Grip/Support", qty:1, replacement:6399, image: "/gear/steadicam_aero_30_stabilizer_system.jpg"},
  {name:"Sachtler Aktiv6 Sideload Head + Flowtech 75 Tripod", category:"Grip/Support", qty:1, replacement:3325, image: "/gear/sachtler_aktiv6_sideload_fluid_head_system_with_flowtech75_tripod.jpg"},
  {name:"DJI RS 4 Pro Gimbal Stabilizer", category:"Grip/Support", qty:1, replacement:1049, image: "/gear/dji_ronin_rs2.png"},
  {name:"DJI RS 3 Pro Gimbal Stabilizer", category:"Grip/Support", qty:1, replacement:869, image: "/gear/dji_ronin_rs2.png"},
  {name:"Crane 2S Gimbal", category:"Grip/Support", qty:1, replacement:449, image: "/gear/crane_2s.jpg"},
  {name:"Tilta Nucleus-M (Lens-Control Set)", category:"Grip/Support", qty:1, replacement:999, image: "/gear/tilta_nucleus-m.webp"},
  {name:"Edelkrone SliderPlus V5", category:"Grip/Support", qty:1, replacement:699, image: "/gear/edelkrone_sliderplus_v5.jpg"},
  {name:"Benro C3883 CF Travel Tripod + S6Pro Head", category:"Grip/Support", qty:1, replacement:649, image: "/gear/benro_c3883_reverse-folding_carbon_fiber_travel_tripod_with_s6pro_fluid_video_head.jpg"},
  {name:"E-Image EK60AAM Tripod", category:"Grip/Support", qty:1, replacement:599, image: "/gear/e-image_ek60aam.jpg"},
  {name:"Benro Aero 7 Tripod", category:"Grip/Support", qty:1, replacement:499, image: "/gear/benro_aero_7_tripod.jpg"},
  {name:"SmallRig AP-02 Lightweight Travel Tripod (Arca)", category:"Grip/Support", qty:2, replacement:0, image: "/gear/smallrig_ap-02_lightweight_aluminum_travel_tripod_with_arca-type_ball_head.jpg"},
  {name:"Zomei Z669C Tripod/Monopod System", category:"Grip/Support", qty:1, replacement:99, image: "/gear/zomei_z669c.jpg"},
  {name:"Flycam Flowline (Camera Support Rig)", category:"Grip/Support", qty:1, replacement:349, image: "/gear/flycam_flowline__camera_support_rig_.jpg"},
  {name:"Glide Gear SNC100 Snorricam DSLR Vest Harness", category:"Grip/Support", qty:1, replacement:149, image: "/gear/glide_gear_snc100_snorricam_dslr_vest_harness.jpg"},
  {name:"Tiltaing Pocket Follow Focus", category:"Grip/Support", qty:1, replacement:99, image: "/gear/tilta_tiltaing_pocket_follow_focus.jpg"},
  // --- STANDS / GRIP ---
  {name:"Avenger Turtle Base C-Stand Grip Arm Kit", category:"Stands/Grip", qty:6, replacement:249, image: "/gear/avenger_turtle_base_c-stand_grip_arm_kit.jpg"},
  {name:"Manfrotto Alu Master Air-Cushioned Light Stand", category:"Stands/Grip", qty:7, replacement:189, image: "/gear/manfrotto_alu_master_air-cushioned_stand.jpg"},
  {name:"Impact C-Stand with Quick Release", category:"Stands/Grip", qty:2, replacement:149, image: "/gear/impact_c-stand_with_quick_release.jpg"},
  {name:"Impact Swivel Umbrella Adapter", category:"Stands/Grip", qty:4, replacement:27, image: "/gear/impact_swivel_umbrella_adapter.jpg"},
  {name:"Impact 6" End Jaw Vise Grip", category:"Stands/Grip", qty:4, replacement:45, image: "/gear/impact_6___end_jaw_vise_grip.jpg"},
  {name:"Kupo Low Mighty Baby Stand (22.5″)", category:"Stands/Grip", qty:3, replacement:110, image: "/gear/kupo_low_mighty_baby_stand_225_.jpg"},
  {name:"Impact Sandbag", category:"Stands/Grip", qty:12, replacement:25, image: "/gear/impact_sandbag.jpg"},
  {name:"TRP Worldwide Magic Cloth (6×6′)", category:"Stands/Grip", qty:1, replacement:139, image: "/gear/trp_worldwide_magic_cloth_6_x_6.jpg"},
  {name:"Silent Lite Grid Cloth", category:"Stands/Grip", qty:1, replacement:139, image: "/gear/matthews_butterfly_overhead_fabric_-_6x6_-_lite_silent_gridcloth.jpg"},
  {name:"Solid Scrim", category:"Stands/Grip", qty:1, replacement:129, image: "/gear/matthews_butterfly_overhead_fabric_-_6x6_-_solid_scrim.jpg"},
  {name:"Black Block Fabric (4×4′)", category:"Stands/Grip", qty:1, replacement:99, image: "/gear/westcott_scrim_jim_cine_solid_black_block_fabric_4_x_4.jpeg"},

  // --- AUDIO ---
  {name:"Sound Devices MixPre-6 II", category:"Audio", qty:1, replacement:1599, image: "/gear/sound_devices_mixpre-6_ii.jpg"},
  {name:"Sennheiser MKH 60 Microphone", category:"Audio", qty:1, replacement:1499, image: "/gear/sennheiser_mkh60.jpg"},
  {name:"Sennheiser MKH 416 Microphone", category:"Audio", qty:1, replacement:999, image: "/gear/sennheiser_mkh_416.jpg"},
  {name:"Schoeps CMC-6U Microphone", category:"Audio", qty:2, replacement:1299, image: "/gear/schoeps_cmc-_6u.webp"},
  {name:"Neumann KMS100 Hand-held Microphone", category:"Audio", qty:1, replacement:1199, image: "/gear/neumann_kms100.jpg"},
  {name:"sE Electronics V7 ENG Handheld Supercardioid Dynamic Broadcast Microphone", category:"Audio", qty:1, replacement:149, image: "/gear/se_electronics_v7_eng_handheld_supercardioid_dynamic_broadcast_microphone.jpg"},
  {name:"K-Tek KE-89CC Avalon Series Aluminum Boompole", category:"Audio", qty:1, replacement:399, image: "/gear/k-tek_avalon_aluminum_ke110cc_boompole.jpg"},
  {name:"RØDE Wireless PRO 2-Person Clip-On Wireless Microphone System/Recorder with Lavaliers", category:"Audio", qty:3, replacement:399, image: "/gear/r_de_wireless_pro_2_person_clip_on_wireless_microphone_system_recorder_with_lavaliers.jpg"},
  {name:"RØDE Wireless GO II System", category:"Audio", qty:1, replacement:299, image: "/gear/rode_wireless_go_ii.webp"},
  {name:"Sony XLR-K3M Adapter Kit with Shotgun Microphone", category:"Audio", qty:1, replacement:349, image: "/gear/sony_xlr_k3m_adapter_kit_with_shotgun_microphone.jpg"},
  {name:"Sennheiser ME 2 Omnidirectional Lavalier Microphone", category:"Audio", qty:6, replacement:99, image: "/gear/sennheiser_me_2_omnidirectional_lavalier_microphone.jpg"},
  {name:"Shure SM58 Dynamic Vocal Microphone", category:"Audio", qty:2, replacement:99, image: "/gear/shure_sm58_dynamic_vocal_microphone.jpg"},
  {name:"RØDE VideoMic", category:"Audio", qty:2, replacement:99, image: "/gear/rode_video_mic.jpg"},
  {name:"Deity TC-1 Wireless Timecode Generator", category:"Audio", qty:4, replacement:149, image: "/gear/deity_microphones_tc-1_wireless_timecode_generator.png"},

  // --- PLAYBACK ---
  {name:"Blackmagic Design ATEM Television Studio Pro 4K", category:"Playback & Wireless Video", qty:1, replacement:5055, image: "/gear/blackmagic_design_atem_television_studio_pro_4k.jpg"},
  {name:"Atomos Sumo 19 SE HDR Monitor Recorder & Switcher", category:"Playback & Wireless Video", qty:1, replacement:2199, image: "/gear/atomos_sumo_19__se_hdr_monitor_recorder_and_switcher.jpg"},
  {name:"Teradek Bolt 6 LT 750 3G-SDI/HDMI Wireless Kit", category:"Playback & Wireless Video", qty:1, replacement:3690, image: "/gear/teradek_bolt_6_lt_750_3g-sdi_hdmi_transmitter_receiver_kit.jpg"},
  {name:"Accsoon CineEye 2S Pro Wireless Video TX/RX", category:"Playback & Wireless Video", qty:1, replacement:649, image: "/gear/accsoon_cineeye_2s_pro_wireless_video_transmitter__receiver.jpg"},
  {name:"Atomos Ninja V", category:"Playback & Wireless Video", qty:1, replacement:649, image: "/gear/atomos_ninja_v.jpg"},
  {name:"Atomos Shinobi 7″ Monitor", category:"Playback & Wireless Video", qty:1, replacement:799, image: "/gear/atomos_shinobi_7_inch.jpg"},
  {name:"Atomos Shinobi SDI 5″ 3G-SDI & 4K HDMI Pro Monitor", category:"Playback & Wireless Video", qty:1, replacement:449, image: "/gear/atomos_shinobi_sdi_5__3g-sdi__4k_hdmi_pro_monitor.jpg"},
  {name:"Atomos Shinobi 5″ HDMI 4K Monitor", category:"Playback & Wireless Video", qty:1, replacement:349, image: "/gear/atomos_shinobi_5__hdmi_4k_monitor.jpg"},
  {name:"Wooden Camera Director's Monitor Cage V3", category:"Playback & Wireless Video", qty:1, replacement:349, image: "/gear/wooden_camera_directors_monitor_cage_v3.webp"},
  {name:"Accsoon SeeMo Pro SDI/HDMI to USB-C Video Capture Adapter for iPhone / iPad", category:"Playback & Wireless Video", qty:1, replacement:329, image: "/gear/accsoon_seemo_pro_sdi_hdmi_to_usb_c_video_capture_adapter_for_iphone___ipad.jpg"},
  {name:"DECIMATOR DMON-QUAD 4-Channel 3G-SDI Multiviewer", category:"Playback & Wireless Video", qty:1, replacement:325, image: "/gear/decimator_dmon_quad_4_channel_3g_sdi_multiviewer.jpg"},
  {name:"Magewell USB Capture SDI Plus, One-Channel 2K Capture Device", category:"Playback & Wireless Video", qty:1, replacement:389, image: "/gear/magewell_usb_capture_sdi_plus__one_channel_2k_capture_device.jpg"},
  {name:"Glide Gear TMP 100 Tablet/Smartphone Teleprompter", category:"Playback & Wireless Video", qty:1, replacement:199, image: "/gear/glide_gear_glide_gear_tmp_100_-_tablet__smartphone_teleprompter.jpg"},

  // --- POWER ---
  {name:"Core SWX Hypercore Neo 9 Mini 98 Wh Battery (VB155)", category:"Power", qty:2, replacement:379, image: "/gear/core_3x_swx_hypercore_neo_9_mini_98wh.jpg"},
  {name:"SmallRig VB212 Mini V-Mount Battery (Caleb Pike)", category:"Power", qty:2, replacement:199, image: "/gear/smallrig_vb212_mini_v_mount_battery__caleb_pike_.jpg"},
  {name:"SmallRig VB155 Mini V-Mount Battery", category:"Power", qty:1, replacement:0, image: "/gear/smallrig_vb155_mini_v-mount_battery.jpg"},
  {name:"SmallRig VB99 Pro Mini V-Mount Battery", category:"Power", qty:12, replacement:99, image: "/gear/smallrig_vb99_pro_mini_v_mount_battery.jpg"},
  {name:"FXLION Nano One 50 Wh 14.8 V Ultra-Compact V-Mount Battery", category:"Power", qty:1, replacement:0, image: "/gear/fxlion_nano_one_50wh_148v_ultra-compact_v-mount_battery.jpg"},
  {name:"TiltaWh Battery", category:"Power", qty:1, replacement:379, image: "/gear/tiltawh_battery.jpg"},
  {name:"Tether Tools Onsite D-Tap Battery with V-Mount", category:"Power", qty:1, replacement:0, image: "/gear/tether_tools_onsite_d-tap_battery_with_v-mount.jpg"},

  // --- COMMS ---
  {name:"Hollyland Solidcom C1-6S Full-Duplex Wireless DECT Intercom System with 6 Headsets", category:"Comms", qty:1, replacement:999, image: "/gear/hollyland_solidcom_c1_6s_full_duplex_wireless_dect_intercom_system_with_6_headsets.jpg"},
  {name:"Eartec UL5D 5-Person Full-Duplex Wireless Intercom with 5 UltraLITE Dual-Ear Headsets", category:"Comms", qty:1, replacement:1000, image: "/gear/eartec_ul5d_5-person_full-duplex_wireless_intercom_with_5_ultralite_dual-ear_headsets.jpg"},

  // --- CARTS / CASES ---
  {name:"Multicart 8-in-1 Equipment Transporter R2RT Micro Glider (black)", category:"Carts/Cases", qty:1, replacement:0, image: "/gear/multicart_8-in-1_equipment_transporter_r2rg_micro_glider_black.jpg"},
  {name:"Tenba Rolling Grip Case – 48″", category:"Carts/Cases", qty:1, replacement:0, image: "/gear/tenba_rolling_grip_case___48_.jpg"},
  {name:"Matthews C-Stand Rolling Kit Bag", category:"Carts/Cases", qty:1, replacement:0, image: "/gear/matthews_c-stand_rolling_kit_bag.webp"},
  {name:"Kupo 4-in-1 Nesting Apple Box Set", category:"Carts/Cases", qty:1, replacement:0, image: "/gear/kupo_4-in-1_nesting_apple_box_set.jpg"},
  {name:"Kupo Full Apple and Half (boxes)", category:"Carts/Cases", qty:1, replacement:119, image: "/gear/kupo_full_apple_and_half.webp"},

  // --- COMPUTING ---
  {name:"iPad Pro 12.9 inch 6th Gen", category:"Computing", qty:1, replacement:500, image: "/gear/ipad_pro_12_9_inch_6th_gen.jpg"},
  {name:"MacBook Pro 16 inch 2021", category:"Computing", qty:1, replacement:1000, image: "/gear/macbook_pro_16_inch_2021.jpg"},

  // --- BACKDROPS ---
  {name:"Westcott 130 Wrinkle-Resistant Chroma-Key Backdrop (9×10′)", category:"Backdrops", qty:1, replacement:0, image: "/gear/westcott_130_wrinkle-resistant_chroma-key_backdrop_9_x_10_green_screen.jpg"},
  {name:"Savage #20 Black Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage_20_black_seamless_background_paper_107_x_36.jpg"},
  {name:"Savage #66 Pure White Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage_66_pure_white_seamless_background_paper_107_x_36.jpg"},
  {name:"Savage #27 Thunder Gray Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage_27_thunder_gray_seamless_background_paper_107_x_36.jpg"},
  {name:"Superior Seamless Lunar Gray #071 (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/superior_seamless_lunar_gray_071_photography_backdrop_paper_107_x_36.jpg"},
  {name:"Savage #74 Smoke Gray Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage_74_smoke_gray_seamless_background_paper_107_x_36.jpg"},
  {name:"Savage #24 Orange Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage_24_orange_seamless_background_paper_107_x_36.jpg"},
  {name:"Savage #82 Tangelo Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage_82_tangelo_seamless_background_paper_107_x_36.jpg"},
  {name:"Savage #46 Tech Green Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage_46_tech_green_seamless_background_paper_107_x_36.jpg"},

  // --- SPECIALTY ---
  {name:"Marq Haze 700 Water-Based Fog Machine", category:"Specialty", qty:1, replacement:0, image: "/gear/marq_haze_700___water-based_fog_machine_with_wired_remote_control.jpg"},
]