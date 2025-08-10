use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{App, AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_opener::OpenerExt;

pub fn create_menu<R: Runtime>(app: &App<R>) -> Result<tauri::menu::Menu<R>, tauri::Error> {
    let quit_item = MenuItemBuilder::new("Quit Commander")
        .id("quit")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;

    let commander_menu = SubmenuBuilder::new(app, "Commander")
        .text("about", "About Commander")
        .text("check-updates", "Check for Updates")
        .separator()
        .text("security-settings", "Security Settings")
        .text("jurisdictional-compliance", "Jurisdictional Compliance")
        .separator()
        .item(&quit_item)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .build()?;

    let mining_menu = SubmenuBuilder::new(app, "Mining")
        .text("mining-dashboard", "Open Mining Dashboard")
        .separator()
        .text("configure-mining-bot", "Configure Mining Bot")
        .text("token-transfer-to-mining", "Token Transfer Window")
        .build()?;

    let vaulting_menu = SubmenuBuilder::new(app, "Vaulting")
        .text("vaulting-dashboard", "Open Vaulting Dashboard")
        .separator()
        .text("configure-vault-settings", "Configure Vault Settings")
        .text("token-transfer-to-vaulting", "Token Transfer Window")
        .build()?;

    let reload_item = MenuItemBuilder::new("Reload UI")
        .id("reload")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .fullscreen()
        .separator()
        .item(&reload_item)
        .build()?;

    let troubleshooting_menu = SubmenuBuilder::new(app, "Troubleshooting")
        .text("troubleshooting:server-diagnostics", "Server Diagnostics")
        .text("troubleshooting:data-and-log-files", "Data and Logging Files")
        .separator()
        .text("troubleshooting:options-for-restart", "Advanced Restart")
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .items(&[&troubleshooting_menu])
        .separator()
        .text("documentation", "Documentation")
        .text("faq", "Frequently Asked Questions")
        .separator()
        .text("discord-community", "Discord User Community")
        .text("github-community", "GitHub Developer Community")
        .separator()
        .text("about", "About")
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&commander_menu, &edit_menu, &mining_menu, &vaulting_menu, &window_menu, &help_menu])
        .build()?;

    Ok(menu)
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: &tauri::menu::MenuEvent) {
    match event.id().0.as_str() {
        "about" => {
            // Emit event to frontend to open About overlay
            app.emit("openAboutOverlay", ()).unwrap();
        }
        "documentation" => {
            let _ = app.opener().open_url("https://argonprotocol.org/docs", None::<&str>);
        }
        "faq" => {
            let _ = app.opener().open_url("https://argonprotocol.org/faq", None::<&str>);
        }
        "github-community" => {
            // Open GitHub issues page in default browser
            let _ = app.opener().open_url("https://github.com/argonprotocol/commander/issues", None::<&str>);
        }
        "discord-community" => {
            let _ = app.opener().open_url("https://discord.gg/xDwwDgCYr9", None::<&str>);
        }
        "check-updates" => {
            // TODO: Implement Check for Updates functionality
            println!("Check for Updates clicked");
        }
        "security-settings" => {
            app.emit("openSecuritySettings", ()).unwrap();
        }
        "jurisdictional-compliance" => {
            app.emit("openJurisdictionalCompliance", ()).unwrap();
        }
        "quit" => {
            app.exit(0);
        }
        "mining-dashboard" => {
            app.emit("openMiningDashboard", ()).unwrap();
        }
        "vaulting-dashboard" => {
            app.emit("openVaultingDashboard", ()).unwrap();
        }
        "configure-mining-bot" => {
            app.emit("openConfigureMiningBot", ()).unwrap();
        }
        "configure-vault-settings" => {
            app.emit("openConfigureVaultSettings", ()).unwrap();
        }
        "token-transfer-to-mining" => {
            app.emit("openMiningWalletOverlay", ()).unwrap();
        }
        "token-transfer-to-vaulting" => {
            app.emit("openVaultingWalletOverlay", ()).unwrap();
        }
        "reload" => {
            app.get_webview_window("main").unwrap().reload().unwrap();
        }
        "minimize" => {
            app.get_webview_window("main").unwrap().minimize().unwrap();
        }
        "fullscreen" => {
            let window = app.get_webview_window("main").unwrap();
            if window.is_fullscreen().unwrap() {
                window.set_fullscreen(false).unwrap();
            } else {
                window.set_fullscreen(true).unwrap();
            }
        }
        "troubleshooting:server-diagnostics" => {
            app.emit("openTroubleshootingOverlay", "server-diagnostics").unwrap();
        }
        "troubleshooting:data-and-log-files" => {
            app.emit("openTroubleshootingOverlay", "data-and-log-files").unwrap();
        }
        "troubleshooting:options-for-restart" => {
            app.emit("openTroubleshootingOverlay", "options-for-restart").unwrap();
        }
        _ => {}
    }
}
