(function() {
  "use strict";
  var config = {
    clientid: '1cf0ad4850ec72b8fa14',
    base_uri: 'http://localhost:8080/'
  },
  __generateId = function ( length ) {
      var text = "";
      var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

      for( var i=0; i < length; i++ )
          text += possible.charAt(Math.floor(Math.random() * possible.length));

      return text;
  },
  __createCookie = function ( name, value ) {
    __eraseCookie(name);
    var date = new Date();
    date.setTime(date.getTime() + 600000); // +10 mins
    var expires = "; expires="+date.toGMTString();
    document.cookie = name+"="+value+expires+"; path=/";
  },
  __readCookie = function ( name ) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
  },
  __eraseCookie = function ( name ) {
    var date = new Date();
    date.setTime(date.getTime() - 86400000);
    document.cookie = name+"=; expires="+date.toGMTString()+"; path=/";
  },
  __decodeURI = function () {
      var search = location.search.substring(1);
      return search ? JSON.parse('{"' + search.replace(/&/g, '","').replace(/=/g,'":"') + '"}',
             function(key, value) { return key===""?value:decodeURIComponent(value) }):{};
  }, 
  __encodeURI = function(obj, prefix) {
    var str = [];
    for(var p in obj) {
      var k = prefix ? prefix + "[" + p + "]" : p, v = obj[p];
      str.push(typeof v == "object" ?
        __encodeURI(v, k) :
        encodeURIComponent(k) + "=" + encodeURIComponent(v));
    }
    return str.join("&");
  };

  if ( !window.StoryMap ) {
    if (typeof jQuery == 'undefined') {
        console.log("StoryMap requires jQuery");
        return;
    }
    window.StoryMap = {

      projects: function( state ) {
          $.ajax({
            url: "https://api.github.com/users/stagg/repos",
            success: function( data ) {
              var 
              project_tmpl = Handlebars.getTemplate('project_select'),
              context = { project:[] };

              for (var i = data.length - 1; i >= 0; i--) {
                context.project.unshift({
                  name: data[i].name,
                  link: config.base_uri+'?project='+data[i].name+'&state='+state
                });
              };
              console.log(context);
              $('#content').html(project_tmpl(context));
            },
            error: function( error ) {
              console.log(error);
            }
          });
      },
      login: function() {
        var request = {
          client_id: config.clientid,
          redirect_uri: config.base_uri,
          state: __generateId(20),
          scope: 'user,repo'
        };
        var url = 'https://github.com/login/oauth/authorize?';
        url += __encodeURI(request);

        __createCookie('auth_state', request.state);
        document.location.href = url;
      }
    };
  }


  // Init 
  var 
  parameters = __decodeURI(),
  state = parameters.state,
  vaildState = __readCookie('auth_state');
  if ( state != 'undefined' && state === vaildState) {
    $('#content').ready( function() {
      StoryMap.projects(state);
    });
  } else {
    $('#content').ready( function() {
      $('#content').html(Handlebars.getTemplate('login'));
      $('#loginbtn').click( function() {
        StoryMap.login();
      });
    });
  }

})();

