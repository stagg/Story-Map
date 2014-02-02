(function() {
  "use strict";
  var config = {
    clientid: '1cf0ad4850ec72b8fa14',
    base_uri: 'http://localhost:8080/',
    callback_uri: 'http://localhost:8080/auth/'
  };

  if (typeof jQuery == 'undefined') {
      console.log("StoryMap requires jQuery");
      return;
  }

  if (typeof Github == 'undefined') {
      console.log("StoryMap requires Github.js");
      return;
  }

  var storymap = {
    github: null,
    config: config,
    util: {
      __generateId: function ( length ) {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for( var i=0; i < length; i++ )
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
      }
    },
    cookie: {
      __create: function ( name, value ) {
        StoryMap.cookie.__erase(name);
        var date = new Date();
        date.setTime(date.getTime() + 600000); // +10 mins
        var expires = "; expires="+date.toGMTString();
        document.cookie = name+"="+value+expires+"; path=/";
      },
      __read: function ( name ) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i = 0; i < ca.length; i++) {
                var c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1,c.length);
                if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
      },
      __erase: function ( name ) {
        var date = new Date();
        date.setTime(date.getTime() - 86400000);
        document.cookie = name+"=; expires="+date.toGMTString()+"; path=/";
      }
    },
    uri:{
      __decode: function () {
          var search = location.search.substring(1);
          return search ? JSON.parse('{"' + search.replace(/&/g, '","').replace(/=/g,'":"') + '"}',
                 function(key, value) { return key===""?value:decodeURIComponent(value) }):{};
      }, 
      __encode: function(obj, prefix) {
        var str = [];
        for(var p in obj) {
          var k = prefix ? prefix + "[" + p + "]" : p, v = obj[p];
          str.push(typeof v == "object" ?
            StoryMap.uri.__encode(v, k) :
            encodeURIComponent(k) + "=" + encodeURIComponent(v));
        }
        return str.join("&");
      }
    },
    __gitinit: function() {
      var access_token = StoryMap.cookie.__read('access_token');
      if (access_token && StoryMap.github === null) {
        StoryMap.github = new Github({
              token: access_token,
              auth: "oauth"
            });
        return true;
      } else {
        return false;
      }
    },
    projects: function(username) {
      if (StoryMap.__gitinit()) {
        var project_tmpl = Handlebars.getTemplate('project_select'),
            context = { project:[] },
            user = StoryMap.github.getUser(),
            repolist = function(err, repos) {
              for (var i = repos.length - 1; i >= 0; i--) {
                context.project.unshift({
                  name: repos[i].name,
                  link: config.base_uri+'?project='+repos[i].name
                });
              };
              $('#content').html(project_tmpl(context));
            };

        if (username) {
          user.userRepos(username, repolist);
        } else {
          user.repos(repolist);
        }   
        
      } else {
        // StoryMap.login();
      }
    },
    login: function() {
      var request = {
        client_id: config.clientid,
        redirect_uri: config.callback_uri,
        state: StoryMap.util.__generateId(20),
        scope: 'user,repo'
      };
      StoryMap.cookie.__create('auth_state', request.state);
      var url = 'https://github.com/login/oauth/authorize?' + StoryMap.uri.__encode(request);
      document.location.href = url;
    },
    oauth: function (code) {
      return ($.post(
        config.base_uri+'oauth',
        { verification:code },
        function(data, status, xhr) {
          if (data.error || status != 'success') {

          } else {          
            StoryMap.github = new Github({
              token: data.access_token,
              auth: "oauth"
            });
            StoryMap.cookie.__create('access_token', data.access_token);
          }          
        },
        'json'
      ));
    }
  };

  if ( !window.StoryMap || window.StoryMap === {}) {
    window.StoryMap = storymap;
  }

})();

