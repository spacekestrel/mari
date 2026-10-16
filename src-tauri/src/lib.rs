#[cfg(target_os = "linux")]
mod pty;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WebKitGTK's GPU-compositing path renders scrollable regions (like the
    // editor) as a rasterized texture instead of native glyphs, producing
    // visibly blurry/heavy text. Must be set before the webview initializes.
    #[cfg(target_os = "linux")]
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init());

    #[cfg(target_os = "linux")]
    let builder = builder
        .manage(pty::PtyState::default())
        .invoke_handler(tauri::generate_handler![
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
