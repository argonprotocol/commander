use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{App, AppHandle, Emitter, Manager, Runtime};

pub fn create_menu<R: Runtime>(app: &App<R>) -> Result<tauri::menu::Menu<R>, tauri::Error> {
    let quit_item = MenuItemBuilder::new("Quit Commander")
        .id("quit")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;

    let commander_menu = SubmenuBuilder::new(app, "Commander")
        .text("about", "About Commander")
        .text("check-updates", "Check for Updates")
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

    let reload_item = MenuItemBuilder::new("Reload App")
        .id("reload")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .item(&reload_item)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&commander_menu, &edit_menu, &window_menu])
        .build()?;

    Ok(menu)
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: &tauri::menu::MenuEvent) {
    match event.id().0.as_str() {
        "about" => {
            // Emit event to frontend to open About overlay
            app.emit("openAboutOverlay", ()).unwrap();
        }
        "check-updates" => {
            // TODO: Implement Check for Updates functionality
            println!("Check for Updates clicked");
        }
        "quit" => {
            app.exit(0);
        }
        "reload" => {
            app.get_webview_window("main").unwrap().reload().unwrap();
        }
        _ => {}
    }
}
