/*
 * 
 *  CPUPower for GNOME Shell preferences 
 *  - Creates a widget to set the preferences of the cpupower extension
 *
 * Copyright (C) 2015
 *     Martin Koppehel <psl.kontakt@gmail.com>,
 *
 * This file is part of the gnome-shell extension cpupower.
 *
 * gnome-shell extension cpupower is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * gnome-shell extension cpupower is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell extension cpupower.  If not, see
 * <http://www.gnu.org/licenses/>.
 *
 */

const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const GtkBuilder = Gtk.Builder;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext.domain('gnome-shell-extension-cpupower');
const _ = Gettext.gettext;
const Soup = imports.gi.Soup;
const GWeather = imports.gi.GWeather;

const Lang = imports.lang;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const EXTENSIONDIR = Me.dir.get_path();

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.cpupower';

const CPUFreqProfile = new Lang.Class({
	Name: 'cpupower.CPUFreqProfile',
	
	_init: function()
	{
		this.minFrequency=0;
		this.maxFrequency=100;
		this.isTurboBoostActive=true;
		this._name = 'Default';
	},
	
	getMinFrequency: function()
	{
		return this.minFrequency;
	},
	
	getMaxFrequency: function()
	{
		return this.maxFrequency;
	},
	
	getTurboBoost: function()
	{
		return this.isTurboBoostActive;
	},
	
	getName: function()
	{
		return this._name;
	},
	
	save: function()
	{
		return new Array( this.minFrequency, this.maxFrequency, this.isTurboBoostActive, this._name);
	},
	
	load: function(input)
	{
		this.setMinFrequency(input[0]);
		this.setMaxFrequency(input[1]);
		this.setTurboBoost(input[2]);
		this.setName(input[3]);
	},
	
	setMinFrequency: function(value)
	{
		this.minFrequency = value;
	},
	
	setMaxFrequency: function(value)
	{
		this.maxFrequency = value;
	},
	
	setTurboBoost: function(value)
	{
		this.isTurboBoostActive = value;
	},
	
	setName: function(value)
	{
		this._name = value;
	},
});

const CPUPowerPrefsWidget = new GObject.Class(
	{
		Name: 'cpupower.Prefs.Widget',
		GTypeName: 'CPUPowerPrefsWidget',
		Extends: Gtk.Box,
		
		_init: function(params)
		{
			global.log("init");
			this.parent(params);
			
			this.initWindow();
			
			this.add(this.MainWidget);
		},
		
		status : function()
		{
			global.log(arguments[0]);
		},
		
		Window : new Gtk.Builder(),
											  
		initWindow : function()
		{
			this.status("Init window");
			this.Window.add_from_file(EXTENSIONDIR+"/cpupower-settings.ui");
			this.status("CPUPower Settings UI loaded");
			this.MainWidget = this.Window.get_object("main-widget");
			this.TreeView = this.Window.get_object("tree-treeview");
			this.liststore = this.Window.get_object("liststore");
			this.Iter = this.liststore.get_iter_first();
			this.TreeView.set_model(this.liststore);
			let column = new Gtk.TreeViewColumn()
			this.TreeView.append_column(column);
			this.status("Treeview column added");
			let renderer = new Gtk.CellRendererText();
			column.pack_start(renderer,null);
			this.status("Column cell renderer text added");
			
			column.set_cell_data_func(renderer,function()
			{
				arguments[1].markup = arguments[2].get_value(arguments[3],0);
			});
			this.initConfigWidget();
			this.addLabel(_("Show current frequency"));
			this.addSwitch("show_freq_taskbar");
			this.status("Inited config widget");
		},
		
		addLabel : function(text)
		{
			let l = new Gtk.Label({label:text,xalign:0});
			l.visible = 1;
			l.can_focus = 0;
			this.right_widget.attach(l, this.x[0],this.x[1], this.y[0],this.y[1],0,0,0,0);
			this.inc();
		},
		
		addComboBox : function(a,b)
		{
			let that = this;
			let cf = new Gtk.ComboBoxText();
			this.configWidgets.push([cf,b]);
			cf.visible = 1;
			cf.can_focus = 0;
			cf.width_request = 100;
			for(let i in a)
			{
				if(a[i] != 0)
					cf.append(i, a[i]);
			}
			cf.active_id = String(this[b]);
			cf.connect("changed",function(){try{that[b] = Number(arguments[0].get_active_id());}catch(e){that.status(e);}});
			this.right_widget.attach(cf, this.x[0],this.x[1], this.y[0],this.y[1],0,0,0,0);
			this.inc();											
			this.status("Added comboBox("+(this.configWidgets.length-1)+") "+b+" active_id : "+this[b]);
			return 0;
		},
		
		addSwitch : function(a)
		{
			let that = this;
			let sw = new Gtk.Switch();
			this.configWidgets.push([sw,a]);
			sw.visible = 1;
			sw.can_focus = 0;
			sw.active = this[a];
			sw.connect("notify::active",function(){that[a] = arguments[0].active;});
			this.right_widget.attach(sw, this.x[0],this.x[1], this.y[0],this.y[1],0,0,0,0);
			this.inc();
		},
		
		inc : function()
		{
			if(arguments[0])
			{
				this.x[0] = 0;
				this.x[1] = 1;
				this.y[0] = 0;
				this.y[1] = 1;
				return 0;
			}
		 
			if(this.x[0] == 1)
			{
				this.x[0] = 0;
				this.x[1] = 1;
				this.y[0] += 1;
				this.y[1] += 1;
				return 0;
			}
			else
			{
				this.x[0] += 1;
				this.x[1] += 1;
				return 0;
			}
		},
		
		initConfigWidget : function()
		{
			this.configWidgets.splice(0, this.configWidgets.length);
			this.inc(1);
			let a = this.Window.get_object("right-widget-table");
			a.visible = 1;
			a.can_focus = 0;
			this.right_widget = a;
			this.addb = this.Window.get_object("tree-toolbutton-add");
			this.remb = this.Window.get_object("tree-toolbutton-remove");
			this.editb = this.Window.get_object("tree-toolbutton-edit");
			let that = this;
			this.addb.connect("clicked", function() {
				//add new profile
				that.status("add");
				that.addProfile();
			});
			
			this.remb.connect("clicked", function() {
				//remove selected profile
				that.status("remove");
				that.removeProfile();
			});
			
			this.editb.connect("clicked", function() {
				that.status("edit");
				that.editProfile();
			});
			this.refreshUI();
		},
		
		addProfile : function()
		{
			
		},
		
		removeProfile : function()
		{
			
		},
		
		editProfile : function()
		{
			
		},
		
		refreshUI : function()
		{
			this.status("Refresh UI");
			this.MainWidget = this.Window.get_object("main-widget");
			this.treeview = this.Window.get_object("tree-treeview");
			this.liststore = this.Window.get_object("liststore");
			this.Iter = this.liststore.get_iter_first();
			if(typeof this.liststore != "undefined")
			{										
				this.status("Clearing liststore");
				this.liststore.clear();
				this.status("Liststore cleared");
			}
			this.prof = this.profiles;
			global.log(this.prof);
			for(var i = 0; i < this.prof.length; i++)
			{
				let current = this.liststore.append();
				let profile = this.prof[i];
				this.liststore.set_value(current, 0, profile.getName());
				this.status((i+1)+") "+profile.getName()+" added");
			}
			this.treeview.set_model(this.liststore);
		},
		
		loadConfig : function()
		{
			let that = this;
			this.Settings = Convenience.getSettings(SETTINGS_SCHEMA);	
			this.Settings.connect("changed", function(){that.status(0); that.refreshUI();});
		},
		
		get show_freq_taskbar()
		{
			if(!this.Settings)
				this.loadConfig();
			return this.Settings.get_boolean("show-freq-in-taskbar");
		},
	   
		get profiles()
		{
			if(!this.Settings)
				this.loadConfig();
			let _profiles = this.Settings.get_value('profiles');
			global.log(_profiles);
			_profiles = _profiles.deep_unpack();
			let profiles = [];
			for(var j = 0; j < _profiles.length; j++)
			{
				var profile = new CPUFreqProfile();
				profile.load(_profiles[j]);
				profiles.push(profile);
			}
			return profiles;
		},
		
		set profiles(v)
		{
			if(!this.Settings)
				this.loadConfig();
			
			let _profiles = [];
			for(var j = 0; j < v.length; j++)
			{
				var profile = v[j];
				var arr = profile.save();
				_profiles.push(arr);
			}
			global.log(_profiles);
			_profiles = GLib.Variant.new("a(iibs)", _profiles);
			global.log(_profiles);
			this.Settings.set_value('profiles', _profiles);
		},
		
		set show_freq_taskbar(v)
		{
			if(!this.Settings)
				this.loadConfig();
			this.Settings.set_boolean("show-freq-in-taskbar",v);
		},
		
		x : [0,1],
		
		y : [0,1],
		
		configWidgets : [],
		
	});

function init()
{
	Convenience.initTranslations('gnome-shell-extension-cpupower');
}

function buildPrefsWidget()
{
	let widget = new CPUPowerPrefsWidget();
	widget.show_all();
	return widget;
}