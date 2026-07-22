#[tauri::command]
fn save_wallpaper(bytes: Vec<u8>, filename: String) -> Result<String, String> {
    let downloads = dirs::download_dir()
        .ok_or_else(|| "Could not find Downloads folder".to_string())?;
    let path = downloads.join(&filename);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn set_wallpaper(bytes: Vec<u8>, filename: String) -> Result<String, String> {
    use std::process::Command;

    let tmp_dir = std::env::temp_dir().join("prismwall");
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;
    let path = tmp_dir.join(&filename);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;

    let path_str = path.to_string_lossy().to_string();

    let script = format!(
        r#"
        tell application "System Events"
            tell every desktop
                set picture to "{}"
            end tell
        end tell
        "#,
        path_str
    );

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;
        let db_path = format!("{}/Library/Application Support/Dock/desktoppicture.db", home);

        let _ = Command::new("sqlite3")
            .arg(&db_path)
            .arg(format!("UPDATE data SET value = '{}';", path_str))
            .output();

        let _ = Command::new("killall")
            .arg("Dock")
            .output();
    }

    Ok(path_str)
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn set_wallpaper(bytes: Vec<u8>, filename: String) -> Result<String, String> {
    use std::process::Command;

    let tmp_dir = std::env::temp_dir().join("prismwall");
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;
    let path = tmp_dir.join(&filename);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;

    let path_str = path.to_string_lossy().to_string();
    let escaped_path = path_str.replace('\'', "''");
    let script = format!(
        r#"
        Add-Type -TypeDefinition @"
        using System.Runtime.InteropServices;
        public class Wallpaper {{
            [DllImport("user32.dll", SetLastError = true)]
            public static extern bool SystemParametersInfo(int action, int param, string path, int update);
        }}
"@
        [Wallpaper]::SystemParametersInfo(20, 0, '{}', 3) | Out-Null
        "#,
        escaped_path
    );

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(path_str)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
#[tauri::command]
fn set_wallpaper(bytes: Vec<u8>, filename: String) -> Result<String, String> {
    let tmp_dir = std::env::temp_dir().join("prismwall");
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;
    let path = tmp_dir.join(&filename);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Err("Setting wallpaper is currently supported on macOS and Windows.".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_wallpaper, set_wallpaper])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
