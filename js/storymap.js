(function() {
  "use strict";
  var config = {
    base_uri: window.location.origin + '/',
    callback_uri: window.location.origin + '/auth/'
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
    userinfo: null,
    githubStates: {OPEN: "open", CLOSED: "closed"},
    labels: {IN_PROGRESS: "in progress", BLOCKED: "blocked", STORY: "story"},
    metadata: {COST: "SP", PRIORITY: "Priority"},
    metaRegexp: /[^[\]]+(?=])/g,
    metaDelimiter: ": ",
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
        date.setTime(date.getTime() + 360000); // +60 mins
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
      if (access_token != null) {
        if (StoryMap.github === null) {
          StoryMap.github = new Github({
              token: access_token,
              auth: "oauth"
            });
        }
        return true;
      } else {
        // TODO might want to redirect automatically here.
        return false;
      }
    },
    user: function(username) {
      if (StoryMap.__gitinit()) {
        if (StoryMap.userinfo != null && StoryMap.userinfo.login != null) {
          $('#nav').html(Handlebars.getTemplate('nav')(StoryMap.userinfo));
        } else {
          var user = StoryMap.github.getUser();
          user.show(username, function (err, userinfo) {
            StoryMap.userinfo = userinfo;
            StoryMap.user();
          });  
        }
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
                  link: config.base_uri+'#/storymap/'+repos[i].owner.login+'/repo/'+repos[i].name
                });
              };
              $('#content').html(project_tmpl(context));
            };
        if (username) {
          user.userRepos(username, repolist);
        } else {
          user.repos(repolist);
        }
        StoryMap.user();     
      } else {
        routie('');
      }
    },
    login: function() {
      var request = {
        client_id: StoryMap.cookie.__read('clientid'),
        redirect_uri: config.callback_uri,
        state: StoryMap.util.__generateId(20),
        scope: 'user,repo'
      };
      StoryMap.cookie.__create('auth_state', request.state);
      var url = 'https://github.com/login/oauth/authorize?' + StoryMap.uri.__encode(request);
      document.location.href = url;
    },
    oauth: function(code) {
      return ($.post(
        config.base_uri+'oauth',
        {
          verification: code,
          redirect_uri: config.callback_uri
        },
        function(data, status, xhr) {
          if (data.error || status != 'success') {
            // TODO error handling
          } else {   
            var token = StoryMap.cookie.__read('access_token')       
            StoryMap.github = new Github({
              token: token,
              auth: "oauth"
            });
          }
        },
        'json'
      ));
    },
    issues: function(user, project) {
      StoryMap.user();
      if (StoryMap.__gitinit()) {
        var issue = StoryMap.github.getIssues(user, project);
        var map_tmpl = Handlebars.getTemplate('map');
        var context = { epic: {unspecified: { sprint: { backlog: { story: [] } } } } };
        // var context = { unassigned: [], assigned: {} };
        for (var s in StoryMap.githubStates) {
          issue.list({state:StoryMap.githubStates[s], labels:StoryMap.labels.STORY}, function(err, stories) {
            StoryMap.__addStoriesToContext(stories, context);
            $('#content').html(map_tmpl(context));
          });
        }
        console.log(context);
      } else {
        routie('');
      }
    },
    __addStoriesToContext: function(stories, context) {
      for (var i = 0; i < stories.length; ++i) {
        var story = stories[i];
        var body = StoryMap.__parseStoryBody(story);
        var state = StoryMap.__getStoryState(story);
        var assignee = StoryMap.__getStoryAssignee(story);

        var storyData = {
          name: story.title,
          number: story.number,
          assignee: assignee,
          state: state,
          comments: story.comments,
          cost: body.cost,
          priority: body.priority
        };

        var epic = StoryMap.__getStoryEpic(story);
        var sprint = story.milestone;

        if (epic === null) {
          if (sprint === null) {
            context.epic.unspecified.sprint.backlog.story.push(storyData);
          } else {
            if (sprint.title in context.epic.unspecified == false) {
              context.epic.unspecified.sprint[sprint.title] = {story: []};
            }
            context.epic.unspecified.sprint[sprint.title].story.push(storyData);
          }
        } else {
          if (epic in context.epic == false) {
            context.epic[epic] = {sprint: {}};
          }

          if (sprint === null) {
            if ('backlog' in context.epic[epic].sprint == false) {
              context.epic[epic].sprint['backlog'] = {story: []};
            }
            context.epic[epic].sprint['backlog'].story.push(storyData);
          } else {
            if (sprint.title in context.epic[epic].sprint == false) {
              context.epic[epic].sprint[sprint.title] = {story: []};
            }
            context.epic[epic].sprint[sprint.title].story.push(storyData);
          }
        }
      };
    },
    __getStoryState: function(story) {
      if (story.state == StoryMap.githubStates.CLOSED) {
        return "closed";
      }
      for (var i = 0; i < story.labels.length; ++i) {
        var label = story.labels[i].name;
        if (label == StoryMap.labels.IN_PROGRESS) {
          return "in-progress";
        }
        else if (label == StoryMap.labels.BLOCKED) {
          return "blocked";
        }
      }
      return "open";
    },
    __getStoryAssignee: function(story) {
      if (story.assignee === null) {
        return "";
      }
      return story.assignee.login;
    },
    __getStoryEpic: function(story) {
      for (var i = 0; i < story.labels.length; ++i) {
        var epic = story.labels[i].name.match(StoryMap.metaRegexp);
        if (epic !== null) {
          return epic[0];
        }
      }
      return null;
    },
    __parseStoryBody: function(story) {
      var bodyData = {cost: "", priority: ""};
      var body = story.body.match(StoryMap.metaRegexp);
      if (body === null) {
        return bodyData;
      }
      for (var i = 0; i < body.length; ++i) {
        var data = body[i].split(StoryMap.metaDelimiter);
        if (data[0] == StoryMap.metadata.COST) {
          bodyData.cost = data[1];
        }
        if (data[0] == StoryMap.metadata.PRIORITY) {
          bodyData.priority = data[1];
        }
      }
      return bodyData;
    }
  };

  if ( !window.StoryMap || window.StoryMap === {}) {
    window.StoryMap = storymap;
  }

})();
