use serde::Serialize;
use std::ffi::OsString;
use std::fs;
use std::os::windows::ffi::OsStringExt;
use std::path::PathBuf;
use tauri::{command, AppHandle, Manager, Runtime};
use winapi::shared::minwindef::{DWORD, MAX_PATH};
use winapi::um::handleapi::CloseHandle;
use winapi::um::processthreadsapi::OpenProcess;
use winapi::um::winbase::QueryFullProcessImageNameW;
use winapi::um::winnt::PROCESS_QUERY_LIMITED_INFORMATION;
use winapi::um::winuser::{GetForegroundWindow, GetWindowThreadProcessId};

#[derive(Debug, Serialize)]
pub struct ActiveAppInfo {
    pub name: Option<String>,
    pub path: Option<String>,
    pub bundle_id: Option<String>,
}

#[command]
pub async fn get_active_app<R: Runtime>(
    _app_handle: AppHandle<R>,
) -> Result<ActiveAppInfo, String> {
    unsafe {
        let hwnd = GetForegroundWindow();

        if hwnd.is_null() {
            return Ok(ActiveAppInfo {
                name: None,
                path: None,
                bundle_id: None,
            });
        }

        let mut process_id: DWORD = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);

        if process_id == 0 {
            return Ok(ActiveAppInfo {
                name: None,
                path: None,
                bundle_id: None,
            });
        }

        let process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id);

        if process_handle.is_null() {
            return Ok(ActiveAppInfo {
                name: None,
                path: None,
                bundle_id: None,
            });
        }

        let mut buffer: Vec<u16> = vec![0; MAX_PATH];
        let mut size = MAX_PATH as DWORD;

        let result = QueryFullProcessImageNameW(process_handle, 0, buffer.as_mut_ptr(), &mut size);

        CloseHandle(process_handle);

        if result == 0 {
            return Ok(ActiveAppInfo {
                name: None,
                path: None,
                bundle_id: None,
            });
        }

        let exe_path = OsString::from_wide(&buffer[..size as usize])
            .to_string_lossy()
            .into_owned();

        let path_buf = PathBuf::from(&exe_path);
        let exe_name = path_buf
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned());

        Ok(ActiveAppInfo {
            name: exe_name.clone(),
            path: Some(exe_path),
            bundle_id: exe_name,
        })
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

    // Windows 下使用 PowerShell 提取图标
    if let Some(ref exe_path) = app_path {
        let ps_script = format!(
            r#"
            Add-Type -AssemblyName System.Drawing
            $icon = [System.Drawing.Icon]::ExtractAssociatedIcon("{}")
            if ($icon) {{
                $bitmap = $icon.ToBitmap()
                $bitmap.Save("{}")
                $bitmap.Dispose()
                $icon.Dispose()
            }}
            "#,
            exe_path.replace('\\', "\\\\"),
            icon_path.to_string_lossy().replace('\\', "\\\\")
        );

        let result = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_script])
            .output();

        match result {
            Ok(output) if output.status.success() && icon_path.exists() => {
                return Ok(Some(icon_path.to_string_lossy().to_string()));
            }
            _ => {
                return Ok(None);
            }
        }
    }

    Ok(None)
}
