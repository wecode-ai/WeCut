use tauri::{command, AppHandle, Manager, Runtime};

pub static ONBOARDING_WINDOW_LABEL: &str = "onboarding";

// 显示 Onboarding 窗口
#[command]
pub async fn show_onboarding_window<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    println!("[onboarding] Attempting to show onboarding window");

    let window = app_handle.get_webview_window(ONBOARDING_WINDOW_LABEL);

    if let Some(window) = window {
        println!("[onboarding] Found onboarding window, showing");

        // 显示窗口
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();

        println!("[onboarding] Window shown successfully");
    } else {
        println!("[onboarding] ERROR: onboarding window not found! Make sure it's defined in tauri.conf.json");
        return Err("Onboarding window not found".to_string());
    }

    Ok(())
}

// 隐藏 Onboarding 窗口
#[command]
pub async fn hide_onboarding_window<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window(ONBOARDING_WINDOW_LABEL) {
        let _ = window.hide();
    }
    Ok(())
}
