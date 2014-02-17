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
    costs: ['1','2','3','5','8','13','20','40','100'], 
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
        var epicsMap = { "unspecified": {pos:0, color:'F5F5F5'} };
        var sprintsMap = { "backlog": 0 };
        var storiesList = [];

        var haveEpics = StoryMap.__populateEpicsMap(issue, epicsMap);
        var haveSprints = StoryMap.__populateSprintsMap(issue, sprintsMap);
        var haveStories = StoryMap.__populateStoriesList(issue, storiesList);
        $.when(haveEpics, haveSprints, haveStories).done(function() {
          StoryMap.__render(epicsMap, sprintsMap, storiesList);
          $('#expandStories').click(function() {
            var newstate = $(this).attr('state') ^ 1,
                text = newstate ? "Collapse" : "Expand";
            if ( $(this).attr('state')==="0" ) {
                $('#content').find('.panel-body div#collapse:not(.in)').collapse('show');
            } else {
                $('#content').find('.panel-body div#collapse').collapse('hide');
            }
            $(this).html( text );
            $(this).attr('state',newstate)
          });
          $('.story').click(function() {StoryMap.__loadStory(this, storiesList, sprintsMap)});
        });
      } else {
        routie('');
      }
    },
    __loadStory: function(el, stories, sprints) {
      var id = $(el).attr('id');
      var obj = $.grep(stories, function(e){ return e.number == id; })[0];
      obj.sprints = sprints;
      obj.costs = StoryMap.costs;
      $('#storyModal-content').html(Handlebars.getTemplate('story_modal')(obj));
      $('#collapseComments').removeClass('hidden');
      $('#storyComments').removeClass('hidden');
      $('#storyEdit').removeClass('hidden');  
      $('#storyEdit').attr('state', 0)
      
      $('.not-edit').removeClass('hidden'); 
      $('.edit').addClass('hidden'); 
      
      $('#storySubmit').addClass('hidden');
      $('#storyCancel').addClass('hidden');
      $('#storyEdit').click(function() {
          var newstate = $(this).attr('state') ^ 1,
              text = newstate ? "Cancel" : "Edit";
          $('#storyCancel').addClass('hidden');
          if ( $(this).attr('state')==="0" ) {
            $('.not-edit').addClass('hidden');      
            $('.edit').removeClass('hidden');   
            $('#storySubmit').html('Update')
          } else {
            $('.not-edit').removeClass('hidden');      
            $('.edit').addClass('hidden'); 
            $('#storySubmit').html('Create')
          }       
          $(this).html( text );
          $(this).attr('state',newstate)
      });
    },
    __render: function(epicsMap, sprintsMap, storiesList) {
      var map_tmpl = Handlebars.getTemplate('map');
      var context = {epic: [], sprint: []};

      
      for (var epicName in epicsMap) {
        context.epic.push({name:epicName, color:epicsMap[epicName].color});
      }
      for (var sprintName in sprintsMap) {
        var sprintObj = {name: sprintName, epic: []};
        for (var epicName in epicsMap) {
          sprintObj.epic.push([]);
        }
        context.sprint.push(sprintObj);
      }
      for (var i = 0; i < storiesList.length; ++i) {
        var story = storiesList[i];
        var storySprint = sprintsMap[story.sprint];
        var storyEpic = epicsMap[story.epic];
        context.sprint[storySprint].epic[storyEpic.pos].push(story);
      }
      console.log(context);
      $('#content').html(map_tmpl(context));
    },
    __populateEpicsMap: function(issue, epicsMap) {
      var dfd = $.Deferred();
      issue.labels(null, function(err, labels) {
        var epicNames = [];

        for (var i = 0; i < labels.length; i++) {
          var epic = labels[i].name.match(StoryMap.metaRegexp);
          if (epic != null) {
            epicNames.push({name:epic[0], color:labels[i].color});
          }
        }

        for (var i = 0; i < epicNames.length; i++) {
          epicsMap[epicNames[i].name] = {pos:i+1, color:epicNames[i].color};
        }
        dfd.resolve();
      });
      return dfd.promise();
    },
    __populateSprintsMap: function(issue, sprintsMap) {
      var dfd = $.Deferred();
      issue.milestones({state: StoryMap.githubStates['OPEN']}, function(err, sprintObjs) {
        var openSprintObjs = sprintObjs;
        issue.milestones({state: StoryMap.githubStates['CLOSED']}, function(err, sprintObjs) {
          var closedSprintObjs = sprintObjs;
          var allSprintObjs = closedSprintObjs.concat(openSprintObjs).sort(StoryMap.__compareSprints);

          for (var i = 0; i < allSprintObjs.length; i++) {
            sprintsMap[allSprintObjs[i].title] = i+1;
          }
          dfd.resolve();
        });
      });
      return dfd.promise();
    },
    __populateStoriesList: function(issue, storiesList) {
      var dfd = $.Deferred();
      issue.list({state:StoryMap.githubStates['OPEN'], labels:StoryMap.labels.STORY}, function(err, stories) {
        StoryMap.__addStoriesToList(stories, storiesList);

        issue.list({state:StoryMap.githubStates['CLOSED'], labels:StoryMap.labels.STORY}, function(err, stories) {
          StoryMap.__addStoriesToList(stories, storiesList);
          dfd.resolve();
        });
      });
      return dfd.promise();
    },
    __addStoriesToList: function(stories, storiesList) {
      for (var i = 0; i < stories.length; ++i) {
        var story = stories[i];
        var body = StoryMap.__parseStoryBody(story);
        var state = StoryMap.__getStoryState(story);
        var assignee = StoryMap.__getStoryAssignee(story);
        var epicName = StoryMap.__getStoryEpic(story);
        var sprintName = StoryMap.__getStorySprint(story);
        var cleanlabels = StoryMap.__getStoryLabels(story);

        storiesList.push({
          name: story.title,
          epic: epicName,
          sprint: sprintName,
          number: story.number,
          url: story.html_url,
          body: story.body,
          assignee: assignee,
          state: state,
          comments: story.comments,
          cost: body.cost,
          priority: body.priority,
          labels: cleanlabels
        });
      }
    },
    __getStoryState: function(story) {
      if (story.state == StoryMap.githubStates.CLOSED) {
        return {state:"closed", color:"BD2C00"};
      }
      if (story.state == StoryMap.githubStates.OPEN) {
        return {state:"open", color:"6CC644"};
      }
      for (var i = 0; i < story.labels.length; ++i) {
        var label = story.labels[i];
        if (label.name == StoryMap.labels.IN_PROGRESS) {
          return {state:"in-progress", color:label.color};
        }
        else if (label.name == StoryMap.labels.BLOCKED) {
          return {state:"blocked", color:label.color};
        }
      }
      return "open";
    },
    __getStoryAssignee: function(story) {
      if (story.assignee === null) {
        return {name:"Unassigned", url:null, avatar:null};
      }
      return {
        name:   story.assignee.login, 
        url:    story.assignee.html_url, 
        avatar: story.assignee.avatar_url
      };
    },
    __getStoryEpic: function(story) {
      for (var i = 0; i < story.labels.length; ++i) {
        var epic = story.labels[i].name.match(StoryMap.metaRegexp);
        if (epic !== null) {
          return epic[0];
        }
      }
      return "unspecified";
    },
    __getStorySprint: function(story) {
      var sprint = story.milestone;
      if (sprint !== null) {
        return sprint.title;
      }
      return "backlog";
    },
    __getStoryLabels: function(story) {
      var labels = [];
      for (var i = story.labels.length - 1; i >= 0; i--) {
        var label = story.labels[i];
        if (label.name != StoryMap.labels.IN_PROGRESS 
          && label.name != StoryMap.labels.BLOCKED 
          && !label.name.match(StoryMap.metaRegexp)) {
          labels.push(label);
        }
      };
      return labels; 
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
    },
    __compareSprints: function (a, b) {
      if (a.due_on == null && b.due_on == null) {
        return 0
      } else if (a.due_on == null) {
        return 1;
      } else if (b.due_on == null) {
        return -1;
      }

      var aDueDate = Date.parse(a.due_on);
      var bDueDate = Date.parse(b.due_on);

      if (aDueDate < bDueDate) {
        return -1;
      } else if (aDueDate > bDueDate) {
        return 1;
      } else {
        return 0;
      }
    }
  };

  if ( !window.StoryMap || window.StoryMap === {}) {
    window.StoryMap = storymap;
  }

})();