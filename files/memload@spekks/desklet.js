const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;

const UUID = "memload@spekks";

function MemloadDesklet(metadata, deskletId) {
    this._init(metadata, deskletId);
}

function main(metadata, deskletId) {
    return new MemloadDesklet(metadata, deskletId);
}

MemloadDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata, deskletId) {
        Desklet.Desklet.prototype._init.call(this, metadata, deskletId);

        // Bind settings
        this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, deskletId);
        this.settings.bindProperty(Settings.BindingDirection.IN, "type", "type", this.onSettingChanged);
        this.settings.bindProperty(Settings.BindingDirection.IN, "refresh-interval", "refreshInterval", this.onSettingChanged);
        this.settings.bindProperty(Settings.BindingDirection.IN, "design", "design", this.onSettingChanged);
        this.settings.bindProperty(Settings.BindingDirection.IN, "scale-size", "scaleSize", this.onSettingChanged);
        this.settings.bindProperty(Settings.BindingDirection.IN, "text-view", "textView", this.onSettingChanged);
        this.settings.bindProperty(Settings.BindingDirection.IN, "font-color", "fontColor", this.onSettingChanged);
        this.settings.bindProperty(Settings.BindingDirection.IN, "use-custom-color", "useCustomColor", this.onSettingChanged);
        this.settings.bindProperty(Settings.BindingDirection.IN, "circle-color", "circleColor", this.onSettingChanged);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-background", "showBackground", this.onSettingChanged);
        this.settings.bindProperty(Settings.BindingDirection.IN, "hide-decorations", "hideDecorations", this.onSettingChanged);
        this.settings.bindProperty(Settings.BindingDirection.IN, "onclick-action", "onclickAction", this.onSettingChanged);

        // Generate random color if not using custom
        this.randomColor = {
            r: Math.random(),
            g: Math.random(),
            b: Math.random()
        };

        // Base sizes
        this.baseSize = 150;
        this.baseFontSize = 22;
        this.baseSubFontSize = 13;

        this.setupUI();
    },

    setupUI: function() {
        this.canvas = new Clutter.Actor();
        this.textPercent = new St.Label({style_class: "memload-text"});
        this.textSub1 = new St.Label({style_class: "memload-text"});
        this.textSub2 = new St.Label({style_class: "memload-text"});

        this.canvas.add_actor(this.textPercent);
        this.canvas.add_actor(this.textSub1);
        this.canvas.add_actor(this.textSub2);
        this.setContent(this.canvas);

        this.refreshDecoration();
        this.update();
    },

    update: function() {
        this.refreshMemory();
        this.timeout = Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this.update));
    },

    refreshMemory: function() {
        let file = Gio.file_new_for_path("/proc/meminfo");
        file.load_contents_async(null, Lang.bind(this, function(file, response) {
            try {
                let [success, contents, tag] = file.load_contents_finish(response);
                if (success) {
                    let mem = contents.toString();
                    let used, total, free;

                    if (this.type === "swap") {
                        total = parseInt(mem.match(/(SwapTotal):\D+(\d+)/)[2]) * 1024;
                        free = parseInt(mem.match(/(SwapFree):\D+(\d+)/)[2]) * 1024;
                    } else {
                        total = parseInt(mem.match(/(MemTotal):\D+(\d+)/)[2]) * 1024;
                        free = parseInt(mem.match(/(MemAvailable):\D+(\d+)/)[2]) * 1024;
                    }
                    used = total - free;

                    let percent = total > 0 ? Math.round(used * 100 / total) : 0;
                    this.redraw(percent, used, free, total);
                }
            } catch (e) {
                global.logError("memload@spekks: " + e.toString());
            }
        }));
    },

    redraw: function(percent, used, free, total) {
        let size = this.baseSize * this.scaleSize;
        let fontSize = Math.round(this.baseFontSize * this.scaleSize);
        let subFontSize = Math.round(this.baseSubFontSize * this.scaleSize);

        // Get circle color
        let color = this.getCircleColor();

        // Draw the circle
        let canvas = new Clutter.Canvas();
        canvas.set_size(size * global.ui_scale, size * global.ui_scale);
        canvas.connect("draw", Lang.bind(this, function(canvas, cr, width, height) {
            cr.save();
            cr.setOperator(Cairo.Operator.CLEAR);
            cr.paint();
            cr.restore();
            cr.setOperator(Cairo.Operator.OVER);
            cr.scale(width, height);
            cr.translate(0.5, 0.5);

            let offset = Math.PI * 0.5;
            let start = 0 - offset;
            let end = ((percent * Math.PI * 2) / 100) - offset;

            if (this.design === "thin") {
                this.drawThin(cr, start, end, color);
            } else if (this.design === "compact") {
                this.drawCompact(cr, start, end, color);
            } else {
                this.drawThick(cr, start, end, color);
            }

            return true;
        }));
        canvas.invalidate();
        this.canvas.set_content(canvas);
        this.canvas.set_size(size * global.ui_scale, size * global.ui_scale);

        // Update text
        let sub1Text, sub2Text;
        let name = this.type === "swap" ? "Swap" : "RAM";

        switch (this.textView) {
            case "free-total":
                sub1Text = this.formatBytes(free);
                sub2Text = this.formatBytes(total);
                break;
            case "name-used":
                sub1Text = name;
                sub2Text = this.formatBytes(used);
                break;
            case "name-free":
                sub1Text = name;
                sub2Text = this.formatBytes(free);
                break;
            default: // used-total
                sub1Text = this.formatBytes(used);
                sub2Text = this.formatBytes(total);
        }

        let textY = Math.round((size * global.ui_scale) / 2 - fontSize * 1.26 * global.ui_scale);
        this.textPercent.set_position(0, textY);
        this.textPercent.set_text(percent + "%");
        this.textPercent.style = this.getTextStyle(fontSize, size);

        let sub1Y = Math.round(textY + fontSize * 1.25 * global.ui_scale);
        this.textSub1.set_position(0, sub1Y);
        this.textSub1.set_text(sub1Text);
        this.textSub1.style = this.getTextStyle(subFontSize, size);

        let sub2Y = Math.round(sub1Y + subFontSize * 1.25 * global.ui_scale);
        this.textSub2.set_position(0, sub2Y);
        this.textSub2.set_text(sub2Text);
        this.textSub2.style = this.getTextStyle(subFontSize, size);
    },

    drawThin: function(cr, start, end, color) {
        if (this.showBackground) {
            cr.setSourceRGBA(1, 1, 1, 0.2);
            cr.setLineWidth(0.045);
            cr.arc(0, 0, 0.45, 0, Math.PI * 2);
            cr.stroke();
        }
        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setSourceRGBA(color.r, color.g, color.b, 1);
        cr.setLineWidth(0.045);
        cr.arc(0, 0, 0.45, start, end);
        cr.stroke();
    },

    drawCompact: function(cr, start, end, color) {
        if (this.showBackground) {
            cr.setSourceRGBA(1, 1, 1, 0.2);
            cr.setLineWidth(0.4);
            cr.arc(0, 0, 0.2, 0, Math.PI * 2);
            cr.stroke();
        }
        cr.setSourceRGBA(color.r, color.g, color.b, 1);
        cr.setLineWidth(0.4);
        cr.arc(0, 0, 0.2, start, end);
        cr.stroke();
    },

    drawThick: function(cr, start, end, color) {
        if (this.showBackground) {
            cr.setSourceRGBA(1, 1, 1, 0.2);
            cr.setLineWidth(0.19);
            cr.arc(0, 0, 0.4, 0, Math.PI * 2);
            cr.stroke();
        }
        cr.setSourceRGBA(color.r, color.g, color.b, 1);
        cr.setLineWidth(0.19);
        cr.arc(0, 0, 0.4, start, end);
        cr.stroke();
        cr.setSourceRGBA(0, 0, 0, 0.1446);
        cr.setLineWidth(0.048);
        cr.arc(0, 0, 0.329, start, end);
        cr.stroke();
    },

    getCircleColor: function() {
        if (this.useCustomColor) {
            let colors = this.circleColor.match(/\((.*?)\)/)[1].split(",");
            return {
                r: parseInt(colors[0]) / 255,
                g: parseInt(colors[1]) / 255,
                b: parseInt(colors[2]) / 255
            };
        }
        return this.randomColor;
    },

    getTextStyle: function(fontSize, width) {
        return "font-size: " + fontSize + "px; " +
               "width: " + width + "px; " +
               "color: " + this.fontColor + ";";
    },

    formatBytes: function(bytes) {
        if (bytes === 0) return "0 B";
        const units = ["B", "K", "M", "G", "T"];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + units[i];
    },

    refreshDecoration: function() {
        let header = this.type === "swap" ? "Swap" : "Memory";
        this.setHeader(header);
        this.metadata["prevent-decorations"] = this.hideDecorations;
        this._updateDecoration();
    },

    onSettingChanged: function() {
        this.refreshDecoration();
        Mainloop.source_remove(this.timeout);
        this.update();
    },

    on_desklet_clicked: function() {
        if (this.onclickAction === "sysmonitor") {
            Util.spawnCommandLine("gnome-system-monitor -r");
        }
    },

    on_desklet_removed: function() {
        Mainloop.source_remove(this.timeout);
    }
};
