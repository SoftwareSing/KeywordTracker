/**
 * @name KeywordTracker
 * @invite undefined
 * @authorLink undefined
 * @donate undefined
 * @patreon undefined
 * @website https://github.com/sarahkittyy/BDPlugins/tree/master/release/
 * @source https://github.com/sarahkittyy/BDPlugins/blob/master/release/KeywordTracker.plugin.js
 */
/*@cc_on
@if (@_jscript)
	
	// Offer to self-install for clueless users that try to run this directly.
	var shell = WScript.CreateObject("WScript.Shell");
	var fs = new ActiveXObject("Scripting.FileSystemObject");
	var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\BetterDiscord\plugins");
	var pathSelf = WScript.ScriptFullName;
	// Put the user at ease by addressing them in the first person
	shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
	if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
		shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
	} else if (!fs.FolderExists(pathPlugins)) {
		shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
	} else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
		fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
		// Show the user where to put plugins in the future
		shell.Exec("explorer " + pathPlugins);
		shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
	}
	WScript.Quit();

@else@*/

module.exports = (() => {
    const config = {"info":{"name":"KeywordTracker","authors":[{"name":"sawahkitty!~<3","discord_id":"135895345296048128","github_username":"sarahkittyy","twitter_username":"snuggleskittyy"}],"version":"1.0.1","description":"Watch for certain phrases in specified channels, and ping if one is found.","github":"https://github.com/sarahkittyy/BDPlugins/tree/master/release/","github_raw":"https://github.com/sarahkittyy/BDPlugins/blob/master/release/KeywordTracker.plugin.js"},"changelog":[{"title":"Release","items":["Initial release."]},{"title":"v1.0.1","items":["Removed changes to global RegExp.escape"]}],"main":"index.js"};

    return !global.ZeresPluginLibrary ? class {
        constructor() {this._config = config;}
        getName() {return config.info.name;}
        getAuthor() {return config.info.authors.map(a => a.name).join(", ");}
        getDescription() {return config.info.description;}
        getVersion() {return config.info.version;}
        load() {
            BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
                confirmText: "Download Now",
                cancelText: "Cancel",
                onConfirm: () => {
                    require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                    });
                }
            });
        }
        start() {}
        stop() {}
    } : (([Plugin, Api]) => {
        const plugin = (Plugin, Library) => {
  const switchCss = `/** Switch
 -------------------------------------*/

.switch input {
  position: absolute;
  opacity: 0;
}

/**
 * 1. Adjust this to size
 */

.switch {
  display: inline-block;
  font-size: 20px; /* 1 */
  height: 1em;
  width: 2em;
  background: #ADD8E6;
  border-radius: 1em;
}

.switch div {
  height: 1em;
  width: 1em;
  border-radius: 1em;
  background: #FFF;
  box-shadow: 0 0.1em 0.3em rgba(0,0,0,0.3);
  -webkit-transition: all 300ms;
     -moz-transition: all 300ms;
          transition: all 300ms;
}

.switch input:checked + div {
  -webkit-transform: translate3d(100%, 0, 0);
     -moz-transform: translate3d(100%, 0, 0);
          transform: translate3d(100%, 0, 0);
}
`;
  const defaultSettings = {
    keywords: [],
    guilds: {},
  };
  const {
    DiscordAPI,
    DOMTools,
    Patcher,
    Logger,
    Settings,
    Utilities,
    PluginUtilities,
    Modals,
    Toasts: Toast,
    DiscordModules: Modules,
  } = Library;

  const RegexEsacape = function(string) {
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  };

  return class KeywordTracker extends Plugin {
    async onStart() {
      this.loadSettings();
      PluginUtilities.addStyle(this.getName(), switchCss);

      let dispatchModule = BdApi.findModuleByProps('dispatch');
      this.cancelPatch = BdApi.monkeyPatch(dispatchModule, 'dispatch', { after: this.handleMessage.bind(this) });

      this.userId = BdApi.findModuleByProps('getId').getId();
    }

    onStop() {
      this.saveSettings();

      Patcher.unpatchAll(this.getName());
      this.cancelPatch();
      PluginUtilities.removeStyle(this.getName());
    }

    handleMessage(data) {
      try {
        const { methodArguments: args } = data;
        let event = args[0];
        if (event.type !== 'MESSAGE_CREATE') return;
        // get message data
        let { message } = event;
        // get channel data
        let channel = Modules.ChannelStore.getChannel(message.channel_id);
        // assert message data is right
        if (!message.author) {
          message = Modules.MessageStore.getMessage(channel.id, message.id);
          if (!message || !message.author) return;
        }
        if (message.author.id === this.userId) return;
        if (!message.content) return;

        // ensure that the channel this is from is enabled
        if (!this.settings.guilds[channel.guild_id].channels[channel.id]) return;
        
        // run through every single keyword as a regex
        this.settings.keywords.every((kw) => {
          let rx;
          let isSlashRegex = /^\/(.*)\/([a-z]*)$/g.exec(kw);
          if (isSlashRegex != null) {
            let text = isSlashRegex[1];
            let flags = isSlashRegex[2];
            rx = new RegExp(text, flags);
          } else {
            rx = new RegExp(RegexEscape(kw));
          }

          if (rx.test(message.content)) {
            this.pingSuccess(message, channel, rx);
            return false; // stop searching
          }
          return true;
        });
      } catch (e) {
        console.error(e);
      }
    }

    pingSuccess(message, channel, match) {
      Logger.info('Match found!');
      Modules.NotificationModule.showNotification(
        'https://picsum.photos/32', // icon
        `Keyword match!`, // title
        `#${channel.name} - ${message.author.username} matched ${match}.`,
        // opts
        {
          onClick: () => {
            Modules.NavigationUtils.transitionTo(
              `/channels/${message.guild_id}/${channel.id}/${message.id}`,
              undefined,
              undefined,
            );
          }
        }
      );
      //Toast.info(`Message by ${message.author.username} in #${channel.name} matches ${match}`);
    }

    makeSwitch(iv, callback) {
      let label = document.createElement('label');
      label.className = 'switch';
      let input = document.createElement('input');
      input.setAttribute('type', 'checkbox');
      input.checked = iv;
      let div = document.createElement('div');
      label.append(input);
      label.append(div);
      input.addEventListener('input', function (e) { 
        callback(this.checked);
      });
      return label;
    }

    getSettingsPanel() {
      return this.buildSettings().getElement();
    }

    saveSettings() {
      // clear out empty keywords :)
      this.settings.keywords = this.settings.keywords.filter((v) => v.trim().length > 0);
      PluginUtilities.saveSettings('KeywordTracker', this.settings);
    }

    loadSettings() {
      // load settings
      this.settings = Utilities.deepclone(PluginUtilities.loadSettings('KeywordTracker', defaultSettings));
    }

    //TODO: god why
    buildSettings() {
      const { Textbox, SettingPanel, SettingGroup, Keybind, SettingField, /*Switch*/ } = Settings;
      const { sortedGuilds, guilds: normGuilds } = DiscordAPI;
      const { parseHTML } = DOMTools;

      // sorted guilds doesn't have critical data, and the normal guild list isn't sorted.
      const guilds = sortedGuilds.reduce((arr, gobj) => {
        return arr.concat(gobj.discordObject.guilds.map(g => {
          return normGuilds.find(v => v.id === g.id);
        }));
      }, []);
      // when the main guild switch is hit this event is fired, causing all channel switches to sync
      const GuildFlushEvent = new Event('guildflushevent');

      let panel = new SettingPanel();
      // !! KEYWORDS
      let keywords = new SettingGroup('Keywords');
      panel.append(keywords);

      let tip = new SettingField('', 'One regex per line.', null, document.createElement('div'));
      keywords.append(tip);
      
      // add keyword textbox
      let textbox = document.createElement('textarea');
      textbox.value = this.settings.keywords.join('\n');
      textbox.addEventListener('change', () => {
        this.settings.keywords = textbox.value.split('\n');
        this.saveSettings();
      });
      textbox.setAttribute('rows', '8');
      textbox.style.width = '95%';
      textbox.style.resize = 'none';
      textbox.style['margin-left'] = '2.5%';
      textbox.style.borderRadius = '3px';
      textbox.style.border = '2px solid grey';
      textbox.style.backgroundColor = '#ddd';
      keywords.append(textbox);

      // !! CHANNELS
      let channels = new SettingGroup('Channels');
      panel.append(channels);

      // for every guild...
      guilds.forEach(g => {
        // create the group, and thumbnail
        let guildGroup = new SettingGroup(g.name);
        guildGroup.getElement().style['min-height'] = '34px';
        if (g.icon != null) {
          let thumbnail = parseHTML(
            `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp?size=256}" />`
          );
          thumbnail.style.width = '32px';
          thumbnail.style.height = '32px';
          thumbnail.style.float = 'left';
          thumbnail.setAttribute('align', 'left');
          channels.append(thumbnail);
        } else {
          guildGroup.getElement().style['padding-left'] = '16px';
        }

        // add group to settings if it does not exist
        if (this.settings.guilds[g.id] == null) {
          this.settings.guilds[g.id] = {
            // set all channels to disabled by default
            channels: g.channels
              .filter(c => c.type === 'GUILD_TEXT')
              .reduce((obj, c) => {
                obj[c.id] = false;
                return obj;
              }, {}),
            enabled: false,
          };
        }
        // add switch next to guild to toggle all channels
        if (this.settings.guilds[g.id].enabled == null) {
          this.settings.guilds[g.id].enabled = false;
        }
        var guildSwitch = this.makeSwitch(this.settings.guilds[g.id].enabled, (v) => {
          this.settings.guilds[g.id].enabled = v;
          for(let cid in this.settings.guilds[g.id].channels) {
            this.settings.guilds[g.id].channels[cid] = v;
          }
          guildGroup.getElement().dispatchEvent(GuildFlushEvent);
          this.saveSettings();
        });
        guildSwitch.style.marginLeft = '4px';
        if (g.icon == null) {
          guildSwitch.style['margin-left'] = '36px';
        }
        channels.append(guildSwitch);

        channels.append(guildGroup);

        // load channels on click
        let channelLoader = () => {
          // for every channel...
          g.channels
            .filter(c => c.type === 'GUILD_TEXT')
            .forEach((c, i) => {
              // ...add a switch
              let status = this.settings.guilds[g.id].channels[c.id];
              if (status == null) {
                Logger.warn(`channel ${c.id} of guild ${g.id} doesn't exist. creating it.`);
                this.settings.guilds[g.id].channels[c.id] = false;
              }
              let channelSwitch = this.makeSwitch(status, (v) => {
                this.settings.guilds[g.id].channels[c.id] = v;
                this.saveSettings();
              });
              let channelSwitchContainer = document.createElement('div');
              channelSwitchContainer.style.width = '95%';
              channelSwitchContainer.style['margin-left'] = '2.5%';
              channelSwitchContainer.style.display = 'flex';
              channelSwitchContainer.style['justify-content'] = 'space-between';
              channelSwitchContainer.style['margin-bottom'] = '3px';
              channelSwitchContainer.style['border-bottom'] = '1px solid #333';
              let channelSwitchText = document.createElement('h2');
              channelSwitchText.style['font-size'] = '16px';
              channelSwitchText.style['color'] = 'white';
              channelSwitchText.innerText = `${c.name}`;
              channelSwitchContainer.append(channelSwitchText);
              channelSwitchContainer.append(channelSwitch);
              guildGroup.append(channelSwitchContainer);
              // when the guild switch is hit, toggle all these switches
              guildGroup.getElement().addEventListener('guildflushevent', () => {
                channelSwitch.firstElementChild.checked = this.settings.guilds[g.id].enabled;
              }, false);
            });
          // ignore future attempts to load this data :)
          guildGroup.getElement().removeEventListener('click', channelLoader);
        };
        guildGroup.getElement().addEventListener('click', channelLoader);
      });

      this.saveSettings();
      return panel;
    }
  };
};
        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
/*@end@*/