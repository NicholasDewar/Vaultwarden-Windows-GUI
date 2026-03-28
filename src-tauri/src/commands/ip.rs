use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    pub ip: String,
    #[serde(rename = "type")]
    pub interface_type: String,
}

#[tauri::command]
pub fn get_local_ips() -> Result<Vec<NetworkInterface>, String> {
    let interfaces = local_ip_address::list_afinet_netifas().map_err(|e| e.to_string())?;

    let mut result: Vec<NetworkInterface> = Vec::new();

    for (name, ip) in interfaces {
        let ip_str = ip.to_string();

        if ip_str.starts_with("127.") || ip_str == "0.0.0.0" {
            continue;
        }

        let interface_type = if name.to_lowercase().contains("wi-fi")
            || name.to_lowercase().contains("wlan")
            || name.to_lowercase().contains("wireless")
        {
            "Wi-Fi"
        } else if name.to_lowercase().contains("ethernet")
            || name.to_lowercase().contains("lan")
            || name.to_lowercase().contains("eth")
        {
            "Ethernet"
        } else if name.to_lowercase().contains("docker") {
            "Docker"
        } else if name.to_lowercase().contains("veth") {
            "Virtual"
        } else {
            "Other"
        };

        result.push(NetworkInterface {
            name,
            ip: ip_str,
            interface_type: interface_type.to_string(),
        });
    }

    if result.is_empty() {
        if let Ok(local_ip) = local_ip_address::local_ip() {
            let ip_str = local_ip.to_string();
            if !ip_str.starts_with("127.") && ip_str != "0.0.0.0" {
                result.push(NetworkInterface {
                    name: "Default".to_string(),
                    ip: ip_str,
                    interface_type: "Unknown".to_string(),
                });
            }
        }
    }

    log::info!("Found {} network interfaces", result.len());
    Ok(result)
}
