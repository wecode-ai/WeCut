use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{command, AppHandle, Manager, Runtime};
use x11::xlib::{self, Display, XCloseDisplay, XGetInputFocus, XOpenDisplay};

#[derive(Debug, Serialize)]
pub struct ActiveAppInfo {
    pub name: Option<String>,
    pub path: Option<String>,
    pub bundle_id: Option<String>,
}

/// 通过 X11 window 获取 PID
unsafe fn get_window_pid(display: *mut Display, window: u64) -> Option<u32> {
    let mut actual_type: x11::xlib::Atom = 0;
    let mut actual_format: i32 = 0;
    let mut nitems: u64 = 0;
    let mut bytes_after: u64 = 0;
    let mut prop: *mut u8 = std::ptr::null_mut();

    let pid_atom = x11::xlib::XInternAtom(display, b"_NET_WM_PID\0".as_ptr() as _, xlib::False);

    let result = x11::xlib::XGetWindowProperty(
        display,
        window,
        pid_atom,
        0,
        1,
        xlib::False,
        xlib::AnyPropertyType as _,
        &mut actual_type,
        &mut actual_format,
        &mut nitems,
        &mut bytes_after,
        &mut prop,
    );

    if result == xlib::Success as i32 && !prop.is_null() && nitems > 0 {
        let pid = *(prop as *const u32);
        x11::xlib::XFree(prop as *mut _);
        Some(pid)
    } else {
        if !prop.is_null() {
            x11::xlib::XFree(prop as *mut _);
        }
        None
    }
}

/// 通过 PID 获取进程名和路径
fn get_process_info(pid: u32) -> (Option<String>, Option<String>) {
    // 读取 /proc/{pid}/exe 获取可执行文件路径
    let exe_link = format!("/proc/{}/exe", pid);
    let exe_path = fs::read_link(&exe_link).ok();

    let path = exe_path.as_ref().map(|p| p.to_string_lossy().into_owned());
    let name = exe_path
        .as_ref()
        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().into_owned()));

    (name, path)
}

#[command]
pub async fn get_active_app<R: Runtime>(
    _app_handle: AppHandle<R>,
) -> Result<ActiveAppInfo, String> {
    unsafe {
        let display = XOpenDisplay(std::ptr::null_mut());
        if display.is_null() {
            return Err("Could not open display".to_string());
        }

        let mut window: u64 = 0;
        let mut revert_to: i32 = 0;
        XGetInputFocus(display, &mut window, &mut revert_to);

        if window <= 1 {
            XCloseDisplay(display);
            return Ok(ActiveAppInfo {
                name: None,
                path: None,
                bundle_id: None,
            });
        }

        let pid = get_window_pid(display, window);
        XCloseDisplay(display);

        if let Some(pid) = pid {
            let (name, path) = get_process_info(pid);
            let bundle_id = name.clone();

            Ok(ActiveAppInfo {
                name,
                path,
                bundle_id,
            })
        } else {
            Ok(ActiveAppInfo {
                name: None,
                path: None,
                bundle_id: None,
            })
        }
    }
}

#[command]
pub async fn get_app_icon<R: Runtime>(
    app_handle: AppHandle<R>,
    bundle_id: String,
    app_path: Option<String>,
) -> Result<Option<String>, String> {
    let cache_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("app-icons");

    fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let icon_path = cache_dir.join(format!("{}.png", bundle_id.replace('.', "_")));

    // 已缓存则直接返回
    if icon_path.exists() {
        return Ok(Some(icon_path.to_string_lossy().to_string()));
    }

    // 尝试从 .desktop 文件查找图标
    if let Some(icon_name) = find_desktop_icon(&bundle_id) {
        // 使用 gtk-icon-info 或直接查找主题图标
        let icon_dirs = [
            "/usr/share/icons/hicolor/64x64/apps",
            "/usr/share/icons/hicolor/48x48/apps",
            "/usr/share/icons/hicolor/128x128/apps",
            "/usr/share/pixmaps",
        ];

        for dir in &icon_dirs {
            let possible = PathBuf::from(dir);

            for ext in &["png", "svg", "xpm"] {
                let icon_file = possible.join(format!("{}.{}", icon_name, ext));
                if icon_file.exists() {
                    // 直接复制 PNG，或者对于非 PNG 格式先返回原路径
                    if *ext == "png" {
                        let _ = fs::copy(&icon_file, &icon_path);
                        return Ok(Some(icon_path.to_string_lossy().to_string()));
                    } else {
                        return Ok(Some(icon_file.to_string_lossy().to_string()));
                    }
                }
            }
        }
    }

    Ok(None)
}

/// 从 .desktop 文件中查找图标名称
fn find_desktop_icon(app_name: &str) -> Option<String> {
    let desktop_dirs = ["/usr/share/applications", "/usr/local/share/applications"];

    // 同时检查 HOME 目录
    let home_desktop = dirs_next_home().map(|h| format!("{}/.local/share/applications", h));

    for dir in desktop_dirs
        .iter()
        .map(|s| s.to_string())
        .chain(home_desktop)
    {
        let desktop_file = PathBuf::from(&dir).join(format!("{}.desktop", app_name));

        if desktop_file.exists() {
            if let Ok(content) = fs::read_to_string(&desktop_file) {
                for line in content.lines() {
                    if line.starts_with("Icon=") {
                        return Some(line.trim_start_matches("Icon=").trim().to_string());
                    }
                }
            }
        }
    }

    None
}

fn dirs_next_home() -> Option<String> {
    std::env::var("HOME").ok()
}
