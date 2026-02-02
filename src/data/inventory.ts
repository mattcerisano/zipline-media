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
  {name:"Sony Burano 8K Digital Motion Picture Camera", category:"Camera", qty:1, replacement:25000, image: "/gear/sony_burano_8k_digital_motion_picture_camera.jpg"},
  {name:"Sony FX6", category:"Camera", qty:2, replacement:7799, image: "/gear/sony_fx6.jpg"},
  {name:"Sony FX3", category:"Camera", qty:1, replacement:3698, image: "/gear/sony_fx3.jpg"},
  {name:"Sony A7SIII", category:"Camera", qty:2, replacement:3698, image: "/gear/sony_a7siii.jpg"},
  {name:"Sony A7R II", category:"Camera", qty:1, replacement:1398, image: "/gear/sony_a7r_ii.jpg"},
  {name:"DJI Air 2S Drone", category:"Camera", qty:1, replacement:849, image: "/gear/dji_air_2s_drone.jpg"},
  {name:"Insta360 X5", category:"Camera", qty:1, replacement:550, image: "/gear/insta360_x5.jpg"},
  {name:"GoPro Hero 11", category:"Camera", qty:1, replacement:399, image: "/gear/gopro_hero_11.jpg"},

  // --- LENS ---
  // Sony
  {name:"Sony FE 14mm F1.8 GM", category:"Lens", qty:1, replacement:1598, image: "/gear/sony_fe_14mm_f1_8_gm.jpg"},
  {name:"Sony 50mm F1.2 G-Master", category:"Lens", qty:1, replacement:2098, image: "/gear/sony_50mm_f1_2_g_master.jpg"},
  {name:"Sony FE 70-200mm F2.8 GM OSS II", category:"Lens", qty:2, replacement:2798, image: "/gear/sony_fe_70_200mm_f2_8_gm_oss_ii.jpg"},
  // Sigma
  {name:"Sigma 14-24mm F2.8", category:"Lens", qty:1, replacement:1399, image: "/gear/sigma_14_24mm_f2_8.jpg"},
  {name:"Sigma 24-70mm F2.8", category:"Lens", qty:4, replacement:1189, image: "/gear/sigma_24_70mm_f2_8.jpg"},
  {name:"Sigma 28-105mm F2.8 DG DN", category:"Lens", qty:1, replacement:1499, image: "/gear/sigma_28_105mm_f2_8_dg_dn.jpg"},
  {name:"Sigma 35mm F1.4", category:"Lens", qty:1, replacement:799, image: "/gear/sigma_35mm_f1_4.jpg"},
  {name:"Sigma 85mm F1.4 DG DN", category:"Lens", qty:1, replacement:1199, image: "/gear/sigma_85mm_f1_4_dg_dn.jpg"},
  // Sirui Anamorphic
  {name:"Sirui 35mm T2.9 1.6× Full-Frame Anamorphic (Sony E)", category:"Lens", qty:1, replacement:899, image: "/gear/sirui_35mm_t2_9_1_6__full_frame_anamorphic__sony_e_.jpg"},
  {name:"Sirui 50mm T2.9 1.6× Anamorphic Full-Frame", category:"Lens", qty:1, replacement:899, image: "/gear/sirui_50mm_t2_9_1_6__anamorphic_full_frame.jpg"},
  {name:"Sirui 75mm T2.9 1.6× Anamorphic Full-Frame", category:"Lens", qty:1, replacement:899, image: "/gear/sirui_75mm_t2_9_1_6__anamorphic_full_frame.jpg"},
  // Cinema / Manual / Vintage
  {name:"DZOFILM Vespid Prime Cinema Lens Kit B with 25/35/50/75/100/125mm T2.1, 90mm Macro T2.8", category:"Lens", qty:1, replacement:5600, image: "/gear/dzofilm_vespid_prime_cinema_lens_kit_b_with_25_35_50_75_100_125mm_t2_1__90mm_macro_t2_8.jpg"},
  {name:"Venus Optics Laowa 9mm F5.6 FF RL (Sony E)", category:"Lens", qty:1, replacement:599, image: "/gear/venus_optics_laowa_9mm_f5_6_ff_rl__sony_e_.jpg"},
  {name:"Rokinon 85mm F1.4 AS IF UMC (Canon EF)", category:"Lens", qty:1, replacement:249, image: "/gear/rokinon_85mm_f1_4_as_if_umc__canon_ef_.jpg"},
  {name:"MIR-1B 37mm F4", category:"Lens", qty:1, replacement:0, image: "/gear/mir_1b_37mm_f4.jpg"},
  {name:"Super-Takumar 50mm F1.2", category:"Lens", qty:1, replacement:150, image: "/gear/super_takumar_50mm_f1_2.jpg"},
  {name:"Helios 44-2 58mm F2", category:"Lens", qty:1, replacement:75, image: "/gear/helios_44_2_58mm_f2.jpg"},
  {name:"Jupiter 11A 135mm F4", category:"Lens", qty:1, replacement:75, image: "/gear/jupiter_11a_135mm_f4.jpg"},

  // --- LENS ACCESSORIES ---
  {name:"Module 8 L1 Tuner Variable Look Lens Attachment (PL-Mount Lens to E-Mount Camera)", category:"Lens Accessories", qty:1, replacement:2499, image: "/gear/module_8_l1_tuner_variable_look_lens_attachment__pl_mount_lens_to_e_mount_camera_.jpg"},
  {name:"Sony FE 1.4× Teleconverter", category:"Lens Accessories", qty:1, replacement:548, image: "/gear/sony_fe_1_4__teleconverter.jpg"},
  {name:"Sony FE 2.0× Teleconverter", category:"Lens Accessories", qty:1, replacement:548, image: "/gear/sony_fe_2_0__teleconverter.jpg"},
  {name:"PolarPro Basecamp Matte Box", category:"Lens Accessories", qty:1, replacement:599, image: "/gear/polarpro_basecamp_matte_box.jpg"},
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
  {name:"Nanlite PavoTube II 30X 4-Light Kit", category:"Lighting", qty:1, replacement:1800, image: "/gear/nanlite_pavotube_ii_30x_4_light_kit.jpg"},
  {name:"Nanlite PavoTube II 15X Kit", category:"Lighting", qty:1, replacement:800, image: "/gear/nanlite_pavotube_ii_15x_kit.jpg"},
  {name:"Amaran F22c Flexible LED Panel", category:"Lighting", qty:1, replacement:499, image: "/gear/amaran_f22c_flexible_led_panel.jpg"},
  {name:"Amaran F21c Flexible Light Mat", category:"Lighting", qty:1, replacement:399, image: "/gear/amaran_f21c_flexible_light_mat.jpg"},
  {name:"Amaran 200x", category:"Lighting", qty:1, replacement:349, image: "/gear/amaran_200x.jpg"},
  {name:"Amaran 100x", category:"Lighting", qty:2, replacement:249, image: "/gear/amaran_100x.jpg"},
  {name:"Nanlite PavoBulb 10C Bi-Color RGBWW LED Bulb (4-Light Kit)", category:"Lighting", qty:1, replacement:699, image: "/gear/nanlite_pavobulb_10c_bi_color_rgbww_led_bulb__4_light_kit_.jpg"},
  {name:"Ulanzi UA20 20W Bi-Color Inflatable Tube Light", category:"Lighting", qty:2, replacement:60, image: "/gear/ulanzi_ua20_20w_bi_color_inflatable_tube_light.jpg"},
  {name:"Ulanzi UA12 Bi-Color Inflatable Tube Light", category:"Lighting", qty:5, replacement:36, image: "/gear/ulanzi_ua12_bi_color_inflatable_tube_light.jpg"},
  {name:"Ulanzi UA20C RGB Inflatable Tube Light", category:"Lighting", qty:2, replacement:76, image: "/gear/ulanzi_ua20c_rgb_inflatable_tube_light.jpg"},
  {name:"Aputure MC", category:"Lighting", qty:3, replacement:90, image: "/gear/aputure_mc.jpg"},

  // --- MODIFIERS ---
  {name:"Kupo Butterfly Frame Kit (6×6)", category:"Modifiers", qty:1, replacement:379, image: "/gear/kupo_butterfly_frame_kit__6_6_.jpg"},
  {name:"Angler 48″ Boombox Octagonal Softbox (Bowens)", category:"Modifiers", qty:2, replacement:279, image: "/gear/angler_48__boombox_octagonal_softbox__bowens_.jpg"},
  {name:"Impact PortaFrame 24×36 Scrim-Flag Kit", category:"Modifiers", qty:1, replacement:249, image: "/gear/impact_portaframe_24_36_scrim_flag_kit.jpg"},
  {name:"Glow EZ Lock 12×56″ Softbox", category:"Modifiers", qty:1, replacement:199, image: "/gear/glow_ez_lock_12_56__softbox.jpg"},
  {name:"Glow EZ Lock Deep Parabolic Softbox (28″)", category:"Modifiers", qty:1, replacement:119, image: "/gear/glow_ez_lock_deep_parabolic_softbox__28__.jpg"},
  {name:"Aputure Lantern Softbox", category:"Modifiers", qty:1, replacement:119, image: "/gear/aputure_lantern_softbox.jpg"},

  // --- GRIP / SUPPORT ---
  {name:"Steadicam Aero 30 Stabilizer System", category:"Grip/Support", qty:1, replacement:6399, image: "/gear/steadicam_aero_30_stabilizer_system.jpg"},
  {name:"Sachtler Aktiv6 Sideload Head + Flowtech 75 Tripod", category:"Grip/Support", qty:1, replacement:3325, image: "/gear/sachtler_aktiv6_sideload_head___flowtech_75_tripod.jpg"},
  {name:"DJI RS 4 Pro Gimbal Stabilizer", category:"Grip/Support", qty:1, replacement:1049, image: "/gear/dji_rs_4_pro_gimbal_stabilizer.jpg"},
  {name:"DJI RS 3 Pro Gimbal Stabilizer", category:"Grip/Support", qty:1, replacement:869, image: "/gear/dji_rs_3_pro_gimbal_stabilizer.jpg"},
  {name:"Crane 2S Gimbal", category:"Grip/Support", qty:1, replacement:449, image: "/gear/crane_2s_gimbal.jpg"},
  {name:"Tilta Nucleus-M (Lens-Control Set)", category:"Grip/Support", qty:1, replacement:999, image: "/gear/tilta_nucleus_m__lens_control_set_.jpg"},
  {name:"Edelkrone SliderPlus V5", category:"Grip/Support", qty:1, replacement:699, image: "/gear/edelkrone_sliderplus_v5.jpg"},
  {name:"Benro C3883 CF Travel Tripod + S6Pro Head", category:"Grip/Support", qty:1, replacement:649, image: "/gear/benro_c3883_cf_travel_tripod___s6pro_head.jpg"},
  {name:"E-Image EK60AAM Tripod", category:"Grip/Support", qty:1, replacement:599, image: "/gear/e_image_ek60aam_tripod.jpg"},
  {name:"Benro Aero 7 Tripod", category:"Grip/Support", qty:1, replacement:499, image: "/gear/benro_aero_7_tripod.jpg"},
  {name:"SmallRig AP-02 Lightweight Travel Tripod (Arca)", category:"Grip/Support", qty:2, replacement:0, image: "/gear/smallrig_ap_02_lightweight_travel_tripod__arca_.jpg"},
  {name:"Zomei Z669C Tripod/Monopod System", category:"Grip/Support", qty:1, replacement:99, image: "/gear/zomei_z669c_tripod_monopod_system.jpg"},
  {name:"Flycam Flowline (Camera Support Rig)", category:"Grip/Support", qty:1, replacement:349, image: "/gear/flycam_flowline__camera_support_rig_.jpg"},
  {name:"Glide Gear SNC100 Snorricam DSLR Vest Harness", category:"Grip/Support", qty:1, replacement:149, image: "/gear/glide_gear_snc100_snorricam_dslr_vest_harness.jpg"},
  {name:"Tiltaing Pocket Follow Focus", category:"Grip/Support", qty:1, replacement:99, image: "/gear/tiltaing_pocket_follow_focus.jpg"},
  // --- STANDS / GRIP ---
  {name:"Avenger Turtle Base C-Stand Grip Arm Kit", category:"Stands/Grip", qty:6, replacement:249, image: "/gear/avenger_turtle_base_c_stand_grip_arm_kit.jpg"},
  {name:"Manfrotto Alu Master Air-Cushioned Light Stand", category:"Stands/Grip", qty:7, replacement:189, image: "/gear/manfrotto_alu_master_air_cushioned_light_stand.jpg"},
  {name:"Impact C-Stand with Quick Release", category:"Stands/Grip", qty:2, replacement:149, image: "/gear/impact_c_stand_with_quick_release.jpg"},
  {name:"Impact Swivel Umbrella Adapter", category:"Stands/Grip", qty:4, replacement:27, image: "/gear/impact_swivel_umbrella_adapter.jpg"},
  {name:"Impact 6\" End Jaw Vise Grip", category:"Stands/Grip", qty:4, replacement:45, image: "/gear/impact_6___end_jaw_vise_grip.jpg"},
  {name:"Kupo Low Mighty Baby Stand (22.5″)", category:"Stands/Grip", qty:3, replacement:110, image: "/gear/kupo_low_mighty_baby_stand__22_5__.jpg"},
  {name:"Impact Sandbag", category:"Stands/Grip", qty:12, replacement:25, image: "/gear/impact_sandbag.jpg"},
  {name:"TRP Worldwide Magic Cloth (6×6′)", category:"Stands/Grip", qty:1, replacement:139, image: "/gear/trp_worldwide_magic_cloth__6_6__.jpg"},
  {name:"Silent Lite Grid Cloth", category:"Stands/Grip", qty:1, replacement:139, image: "/gear/silent_lite_grid_cloth.jpg"},
  {name:"Solid Scrim", category:"Stands/Grip", qty:1, replacement:129, image: "/gear/solid_scrim.jpg"},
  {name:"Black Block Fabric (4×4′)", category:"Stands/Grip", qty:1, replacement:99, image: "/gear/black_block_fabric__4_4__.jpg"},

  // --- AUDIO ---
  {name:"Sound Devices MixPre-6 II", category:"Audio", qty:1, replacement:1599, image: "/gear/sound_devices_mixpre_6_ii.jpg"},
  {name:"Sennheiser MKH 60 Microphone", category:"Audio", qty:1, replacement:1499, image: "/gear/sennheiser_mkh_60_microphone.jpg"},
  {name:"Sennheiser MKH 416 Microphone", category:"Audio", qty:1, replacement:999, image: "/gear/sennheiser_mkh_416_microphone.jpg"},
  {name:"Schoeps CMC-6U Microphone", category:"Audio", qty:2, replacement:1299, image: "/gear/schoeps_cmc_6u_microphone.jpg"},
  {name:"Neumann KMS100 Hand-held Microphone", category:"Audio", qty:1, replacement:1199, image: "/gear/neumann_kms100_hand_held_microphone.jpg"},
  {name:"sE Electronics V7 ENG Handheld Supercardioid Dynamic Broadcast Microphone", category:"Audio", qty:1, replacement:149, image: "/gear/se_electronics_v7_eng_handheld_supercardioid_dynamic_broadcast_microphone.jpg"},
  {name:"K-Tek KE-89CC Avalon Series Aluminum Boompole", category:"Audio", qty:1, replacement:399, image: "/gear/k_tek_ke_89cc_avalon_series_aluminum_boompole.jpg"},
  {name:"RØDE Wireless PRO 2-Person Clip-On Wireless Microphone System/Recorder with Lavaliers", category:"Audio", qty:3, replacement:399, image: "/gear/r_de_wireless_pro_2_person_clip_on_wireless_microphone_system_recorder_with_lavaliers.jpg"},
  {name:"RØDE Wireless GO II System", category:"Audio", qty:1, replacement:299, image: "/gear/r_de_wireless_go_ii_system.jpg"},
  {name:"Sony XLR-K3M Adapter Kit with Shotgun Microphone", category:"Audio", qty:1, replacement:349, image: "/gear/sony_xlr_k3m_adapter_kit_with_shotgun_microphone.jpg"},
  {name:"Sennheiser ME 2 Omnidirectional Lavalier Microphone", category:"Audio", qty:6, replacement:99, image: "/gear/sennheiser_me_2_omnidirectional_lavalier_microphone.jpg"},
  {name:"Shure SM58 Dynamic Vocal Microphone", category:"Audio", qty:2, replacement:99, image: "/gear/shure_sm58_dynamic_vocal_microphone.jpg"},
  {name:"RØDE VideoMic", category:"Audio", qty:2, replacement:99, image: "/gear/r_de_videomic.jpg"},
  {name:"Deity TC-1 Wireless Timecode Generator", category:"Audio", qty:4, replacement:149, image: "/gear/deity_tc_1_wireless_timecode_generator.jpg"},

  // --- PLAYBACK ---
  {name:"Blackmagic Design ATEM Television Studio Pro 4K", category:"Playback & Wireless Video", qty:1, replacement:5055, image: "/gear/blackmagic_design_atem_television_studio_pro_4k.jpg"},
  {name:"Atomos Sumo 19 SE HDR Monitor Recorder & Switcher", category:"Playback & Wireless Video", qty:1, replacement:2199, image: "/gear/atomos_sumo_19_se_hdr_monitor_recorder___switcher.jpg"},
  {name:"Teradek Bolt 6 LT 750 3G-SDI/HDMI Wireless Kit", category:"Playback & Wireless Video", qty:1, replacement:3690, image: "/gear/teradek_bolt_6_lt_750_3g_sdi_hdmi_wireless_kit.jpg"},
  {name:"Accsoon CineEye 2S Pro Wireless Video TX/RX", category:"Playback & Wireless Video", qty:1, replacement:649, image: "/gear/accsoon_cineeye_2s_pro_wireless_video_tx_rx.jpg"},
  {name:"Atomos Ninja V", category:"Playback & Wireless Video", qty:1, replacement:649, image: "/gear/atomos_ninja_v.jpg"},
  {name:"Atomos Shinobi 7″ Monitor", category:"Playback & Wireless Video", qty:1, replacement:799, image: "/gear/atomos_shinobi_7__monitor.jpg"},
  {name:"Atomos Shinobi SDI 5″ 3G-SDI & 4K HDMI Pro Monitor", category:"Playback & Wireless Video", qty:1, replacement:449, image: "/gear/atomos_shinobi_sdi_5__3g_sdi___4k_hdmi_pro_monitor.jpg"},
  {name:"Atomos Shinobi 5″ HDMI 4K Monitor", category:"Playback & Wireless Video", qty:1, replacement:349, image: "/gear/atomos_shinobi_5__hdmi_4k_monitor.jpg"},
  {name:"Wooden Camera Director's Monitor Cage V3", category:"Playback & Wireless Video", qty:1, replacement:349, image: "/gear/wooden_camera_director_s_monitor_cage_v3.jpg"},
  {name:"Accsoon SeeMo Pro SDI/HDMI to USB-C Video Capture Adapter for iPhone / iPad", category:"Playback & Wireless Video", qty:1, replacement:329, image: "/gear/accsoon_seemo_pro_sdi_hdmi_to_usb_c_video_capture_adapter_for_iphone___ipad.jpg"},
  {name:"DECIMATOR DMON-QUAD 4-Channel 3G-SDI Multiviewer", category:"Playback & Wireless Video", qty:1, replacement:325, image: "/gear/decimator_dmon_quad_4_channel_3g_sdi_multiviewer.jpg"},
  {name:"Magewell USB Capture SDI Plus, One-Channel 2K Capture Device", category:"Playback & Wireless Video", qty:1, replacement:389, image: "/gear/magewell_usb_capture_sdi_plus__one_channel_2k_capture_device.jpg"},
  {name:"Glide Gear TMP 100 Tablet/Smartphone Teleprompter", category:"Playback & Wireless Video", qty:1, replacement:199, image: "/gear/glide_gear_tmp_100_tablet_smartphone_teleprompter.jpg"},

  // --- POWER ---
  {name:"Core SWX Hypercore Neo 9 Mini 98 Wh Battery (VB155)", category:"Power", qty:2, replacement:379, image: "/gear/core_swx_hypercore_neo_9_mini_98_wh_battery__vb155_.jpg"},
  {name:"SmallRig VB212 Mini V-Mount Battery (Caleb Pike)", category:"Power", qty:2, replacement:199, image: "/gear/smallrig_vb212_mini_v_mount_battery__caleb_pike_.jpg"},
  {name:"SmallRig VB155 Mini V-Mount Battery", category:"Power", qty:1, replacement:0, image: "/gear/smallrig_vb155_mini_v_mount_battery.jpg"},
  {name:"SmallRig VB99 Pro Mini V-Mount Battery", category:"Power", qty:12, replacement:99, image: "/gear/smallrig_vb99_pro_mini_v_mount_battery.jpg"},
  {name:"FXLION Nano One 50 Wh 14.8 V Ultra-Compact V-Mount Battery", category:"Power", qty:1, replacement:0, image: "/gear/fxlion_nano_one_50_wh_14_8_v_ultra_compact_v_mount_battery.jpg"},
  {name:"TiltaWh Battery", category:"Power", qty:1, replacement:379, image: "/gear/tiltawh_battery.jpg"},
  {name:"Tether Tools Onsite D-Tap Battery with V-Mount", category:"Power", qty:1, replacement:0, image: "/gear/tether_tools_onsite_d_tap_battery_with_v_mount.jpg"},

  // --- COMMS ---
  {name:"Hollyland Solidcom C1-6S Full-Duplex Wireless DECT Intercom System with 6 Headsets", category:"Comms", qty:1, replacement:999, image: "/gear/hollyland_solidcom_c1_6s_full_duplex_wireless_dect_intercom_system_with_6_headsets.jpg"},

  // --- CARTS / CASES ---
  {name:"Multicart 8-in-1 Equipment Transporter R2RT Micro Glider (black)", category:"Carts/Cases", qty:1, replacement:0, image: "/gear/multicart_8_in_1_equipment_transporter_r2rt_micro_glider__black_.jpg"},
  {name:"Tenba Rolling Grip Case – 48″", category:"Carts/Cases", qty:1, replacement:0, image: "/gear/tenba_rolling_grip_case___48_.jpg"},
  {name:"Matthews C-Stand Rolling Kit Bag", category:"Carts/Cases", qty:1, replacement:0, image: "/gear/matthews_c_stand_rolling_kit_bag.jpg"},
  {name:"Kupo 4-in-1 Nesting Apple Box Set", category:"Carts/Cases", qty:1, replacement:0, image: "/gear/kupo_4_in_1_nesting_apple_box_set.jpg"},
  {name:"Kupo Full Apple and Half (boxes)", category:"Carts/Cases", qty:1, replacement:119, image: "/gear/kupo_full_apple_and_half__boxes_.jpg"},

  // --- COMPUTING ---
  {name:"iPad Pro 12.9 inch 6th Gen", category:"Computing", qty:1, replacement:500, image: "/gear/ipad_pro_12_9_inch_6th_gen.jpg"},
  {name:"MacBook Pro 16 inch 2021", category:"Computing", qty:1, replacement:1000, image: "/gear/macbook_pro_16_inch_2021.jpg"},

  // --- BACKDROPS ---
  {name:"Westcott 130 Wrinkle-Resistant Chroma-Key Backdrop (9×10′)", category:"Backdrops", qty:1, replacement:0, image: "/gear/westcott_130_wrinkle_resistant_chroma_key_backdrop__9_10__.jpg"},
  {name:"Savage #20 Black Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage__20_black_seamless__107_36__.jpg"},
  {name:"Savage #66 Pure White Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage__66_pure_white_seamless__107_36__.jpg"},
  {name:"Savage #27 Thunder Gray Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage__27_thunder_gray_seamless__107_36__.jpg"},
  {name:"Superior Seamless Lunar Gray #071 (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/superior_seamless_lunar_gray__071__107_36__.jpg"},
  {name:"Savage #74 Smoke Gray Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage__74_smoke_gray_seamless__107_36__.jpg"},
  {name:"Savage #24 Orange Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage__24_orange_seamless__107_36__.jpg"},
  {name:"Savage #82 Tangelo Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage__82_tangelo_seamless__107_36__.jpg"},
  {name:"Savage #46 Tech Green Seamless (107×36′)", category:"Backdrops", qty:1, replacement:69, image: "/gear/savage__46_tech_green_seamless__107_36__.jpg"},

  // --- SPECIALTY ---
  {name:"Marq Haze 700 Water-Based Fog Machine", category:"Specialty", qty:1, replacement:0, image: "/gear/marq_haze_700_water_based_fog_machine.jpg"},
]
