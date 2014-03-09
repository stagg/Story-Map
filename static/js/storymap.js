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
    priorities: ['1', '2', '3', '4', '5'],
    labels: {IN_PROGRESS: "in progress", BLOCKED: "blocked", STORY: "story"},
    metadata: {COST: "SP", PRIORITY: "Priority", START: "Start"},
    metaRegexp: /[^[\]]+(?=])/g,
    metaDelimiter: ": ",
    epicsList: [],
    sprintsList: [],
    storiesList: [],
    assigneesList: [],
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
      StoryMap.__setupProject();
      StoryMap.user();
      if (StoryMap.__gitinit()) {
        var issue = StoryMap.github.getIssues(user, project);
        StoryMap.issue = issue;
        var haveAssignees = StoryMap.__populateAssigneesList(issue);
        var haveEpics = StoryMap.__populateEpicsList(issue);
        var haveSprints = StoryMap.__populateSprintsList(issue);
        var haveStories = StoryMap.__populateStoriesList(issue);
        $.when(haveAssignees, haveEpics, haveSprints, haveStories).done(function() {
          StoryMap.__setupCreateSprintModal(issue);
          StoryMap.__setupCreateEpicModal(issue);
          StoryMap.__setupCreateStoryModal(issue);
          StoryMap.__renderMap();
          $('#story-map').on('click', '.story', function() {StoryMap.__loadStory(this)});
        });
      } else {
        routie('');
      }
    },
    __setupProject: function() {
      $('#content').html(Handlebars.getTemplate('project'));
    },
    __addComment: function(id) {
      $('#newCommentBtn').click(function (argument) {
        var text = $('#newComment').val();
        if (text !== "") {
          StoryMap.issue.addComment(id, {"body": text}, function (err, comment) {
            if (comment) {
              StoryMap.__loadComments(id);
            }
          });
        }
      });
    },
    __loadComments: function (id) {
      if (StoryMap.__gitinit() && StoryMap.issue) {
        var dfd = $.Deferred();
        StoryMap.issue.issueComments(id, null, function(err, comments) {
          console.log(comments);
          $('#collapseComments').html(Handlebars.getTemplate('story_modal_comments')({"comments":comments}));
          StoryMap.__addComment(id);
          dfd.resolve();
        });
        return dfd.promise();
      }
    },
    __updateStory: function (id, el) {
      var form = $('#story-form').serializeArray();
      var data = {body:"", labels:[]};
      for (var i = form.length - 1; i >= 0; i--) {
        var obj = form[i];
        if (obj.name === "priority") {
          data.body += StoryMap.__convertToMetaDataString( 
            StoryMap.metadata.PRIORITY + StoryMap.metaDelimiter + obj.value) + "\n";
        } else if (obj.name === "cost") {
          data.body += StoryMap.__convertToMetaDataString(
            StoryMap.metadata.COST + StoryMap.metaDelimiter + obj.value) + "\n";
        } else if (obj.name === "feature" && obj.value !== "unspecified") {
          data.labels.push(StoryMap.__convertToMetaDataString(obj.value));
        } else if (obj.name === "state") {
          if (obj.value === StoryMap.githubStates.OPEN || obj.value === StoryMap.githubStates.CLOSED) {
            data.state = obj.value;
          } else {
            data.state = StoryMap.githubStates.OPEN;
            data.labels.push(obj.value);
          }
        } else if(obj.name === "labels[]") {
          data.labels.push(obj.value);
        } else {
          data[obj.name] = obj.value;
        }
      };
      if (StoryMap.__gitinit() && StoryMap.issue) {
        StoryMap.issue.editIssue(id, data, function (err, response) {
          if (response) {
            var story = StoryMap.__createStory(response);
            for (var i = StoryMap.storiesList.length - 1; i >= 0; i--) {
              var obj = StoryMap.storiesList[i];
              if (obj.number === story.number) {
                StoryMap.storiesList[i] = story;
                break;
              }
             }; 
            StoryMap.__renderMap();
            $('#storyModal').modal('hide');
          } else {
            console.log(err);
          }
        });
      }
    },
    __loadStory: function(el) {
      var id = $(el).attr('id');
      var obj = $.grep(StoryMap.storiesList, function(e){ return e.number == id; })[0];
      var context = {};
      for (var prop in obj) {
        context[prop] = obj[prop];
      }
      context.sprints = StoryMap.sprintsList;
      context.costs = StoryMap.costs;
      context.assignees = StoryMap.assigneesList;
      context.priorities = StoryMap.priorities;
      context.epics = StoryMap.epicsList;
      context.epic = StoryMap.__getEpicObject(obj.epic);
      context.body = StoryMap.__removeMetaDataStrings(obj.body);
      $('#storyModal-content').html(Handlebars.getTemplate('story_modal')(context));
      $('#storyEdit').removeClass('hidden');
      $('#storyEdit').attr('state', 0)
      $('.not-edit').removeClass('hidden'); 
      $('.edit').addClass('hidden'); 
      $('#storyEdit').click(function() {
        var newstate = $(this).attr('state') ^ 1,
            text = newstate ? "Cancel" : "Edit";
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
        $(this).attr('state', newstate)
      });
      $('#storySubmit').click(function(event) {
        StoryMap.__updateStory(id, this);
      });
      $('#storyComments').click(function() {
        if ( $('#collapseComments').html() == "") {
          var commentsLoaded = StoryMap.__loadComments(id);
          $.when(commentsLoaded).done(function() {
              $('#collapseComments').toggle();
          });
        } else {
          $('#collapseComments').toggle();
        }
      })
    },
    __createStory: function(story) {
      var body = StoryMap.__parseStoryBody(story);
      var state = StoryMap.__getStoryState(story);
      var assignee = StoryMap.__getStoryAssignee(story);
      var epicName = StoryMap.__getStoryEpic(story);
      var sprintName = StoryMap.__getStorySprint(story);
      var cleanlabels = StoryMap.__getStoryLabels(story);
      return {
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
      };
    },
    __setupCreateSprintModal: function(issue) {
      $('#createSprintStartDate').datepicker({format: "yyyy-mm-dd"});
      $('#createSprintDueDate').datepicker({format: "yyyy-mm-dd"});
      $('#createSprintModal').on('click', '#createSprintBtn', function() {
        var data = {};
        var start = $("#createSprintStartDate").val();
        var due = $("#createSprintDueDate").val();
        var desc = $("#createSprintDesc").val();
        var body = "";
        if (start) {
          body += StoryMap.__convertToMetaDataString(
            StoryMap.metadata.START + StoryMap.metaDelimiter + start) + "\n";
        }
        body += desc;

        data.title = $("#createSprintTitle").val();
        data.description = body;
        data.due_on = due + "T00:00:00Z";

        issue.createMilestone(data, function(err, createdSprint) {
          var repopulatedSprints = StoryMap.__populateSprintsList(issue);
          $.when(repopulatedSprints).done(function() {
            StoryMap.__renderMap();
          });
        });
      });
      $('#createSprintModal').on('hidden.bs.modal', function() {
          $("#createSprintTitle").val("");
          $("#createSprintDesc").val("");
          $("#createSprintStartDate").val("");
          $("#createSprintDueDate").val("");
      });
    },
    __setupCreateEpicModal: function(issue) {
      $('#createEpicColour').colorpicker();
      $('#createEpicModal').on('click', '#createEpicBtn', function() {
        var data = {};
        var name = $("#createEpicName").val();
        var colour = $("#createEpicColour").val();

        data.name = StoryMap.__convertToMetaDataString(name);
        data.color = colour.replace("#", "");

        issue.createLabel(data, function(err, createdEpic) {
          var repopulatedEpics = StoryMap.__populateEpicsList(issue);
          $.when(repopulatedEpics).done(function() {
            StoryMap.__renderMap();
          });
        });
      });
      $('#createEpicModal').on('hidden.bs.modal', function() {
          $("#createEpicName").val("");
          $("#createEpicColour").val("");
      });
    },
    __setupCreateStoryModal: function(issue) {
      var modal_tmpl = Handlebars.getTemplate('create_story_modal');
      var context = {"assignees": StoryMap.assigneesList,
                     "priorities": StoryMap.priorities,
                     "costs": StoryMap.costs,
                     "sprints": StoryMap.sprintsList,
                     "epics": StoryMap.epicsList};
      $('#createStoryModal').html(modal_tmpl(context));
      $('#createStoryModal').on('click', '#createStoryBtn', function() {
        var data = {}
        var priority = $("#createStoryPriority").val();
        var cost = $("#createStoryPoints").val();
        var desc = $("#createStoryDesc").val();
        var sprint = $("#createStorySprint").val();
        var epic = $("#createStoryEpic").val();
        var labels = [StoryMap.labels.STORY];
        var body = ""
        if (priority !== null) {
          body += StoryMap.__convertToMetaDataString(
            StoryMap.metadata.PRIORITY + StoryMap.metaDelimiter + priority) + "\n";
        }
        if (cost !== null) {
          body += StoryMap.__convertToMetaDataString(
            StoryMap.metadata.COST + StoryMap.metaDelimiter + cost) + "\n";
        }
        if (epic !== null && epic.toLowerCase() !== "unspecified") {
          labels.push("'"+StoryMap.__convertToMetaDataString(epic)+"'");
        }
        body += desc;
        
        data.title = $("#createStoryTitle").val();
        data.body = body;
        data.assignee = $("#createStoryAssignee").val();
        data.milestone =  sprint < 0 ? null : sprint;
        data.labels = labels;
        data = StoryMap.util.encode
        issue.createIssue(data, function(err, createdStory) {
          console.log(createdStory);
          var repopulatedStories = StoryMap.__populateStoriesList(issue);
          $.when(repopulatedStories).done(function() {
            StoryMap.__renderMap();
          });
        });
      });
      $('#createStoryModal').on('hidden.bs.modal', function() {
        $("#createStoryTitle").val("");
        $("#createStoryDesc").val("");
        $("#createStoryPriority").val("");
        $("#createStoryPoints").val("");
        $("#createStoryAssignee").val("");
      });
    },
    __renderMap: function() {
      var map_tmpl = Handlebars.getTemplate('map');
      var context = {epic: [], sprint: [], style:{}};
      var epicsMap = {};
      var sprintsMap = {};
      context.style.width = StoryMap.epicsList.length * 150;
      for (var i = 0; i < StoryMap.epicsList.length; ++i) {
        var epic = StoryMap.epicsList[i];
        epicsMap[epic.name] = i;
        context.epic.push({name:epic.name, color:epic.color});
      }
      for (var i = 0; i < StoryMap.sprintsList.length; ++i) {
        var sprint = StoryMap.sprintsList[i];
        sprintsMap[sprint.name] = i;
        var sprintObj = {name: sprint.name, id:sprint.id, epic: [], prc:0, close: 0, open: 0};
        for (var j = 0; j < StoryMap.epicsList.length; ++j) {
          sprintObj.epic.push([]);
        }
        context.sprint.push(sprintObj);
      }
      for (var i = 0; i < StoryMap.storiesList.length; ++i) {
        var story = StoryMap.storiesList[i];
        var storySprint = sprintsMap[story.sprint];
        var storyEpic = epicsMap[story.epic];
        if (story.state.state.toLowerCase() !== StoryMap.githubStates['CLOSED'].toLowerCase()) {
          context.sprint[storySprint].open++;
        } else {
          context.sprint[storySprint].close++;
        }
        context.sprint[storySprint].epic[storyEpic].push(story);
      }
      for (var i = context.sprint.length - 1; i >= 0; i--) {
        var obj = context.sprint[i];
        obj.prc = (obj.open / (obj.close + obj.open)) * 100;
      };
      $('#story-map').html(map_tmpl(context));
      // gridlineIt();
      $('body').scrollspy({ target: '#sprint-menu' });
      $('a.sprint-link').click(function (e) {
        $($(this).attr('href')).goTo();
        e.preventDefault();
      });
    },
    __populateAssigneesList: function(issue) {
      StoryMap.assigneesList = [];
      var dfd = $.Deferred();
      issue.assignees(null, function(err, assignees) {
        for (var i = 0; i < assignees.length; ++i) {
          StoryMap.assigneesList.push(assignees[i].login);
        }
        dfd.resolve();
      });
      return dfd.promise();
    },
    __populateEpicsList: function(issue) {
      StoryMap.epicsList = [];
      var dfd = $.Deferred();
      issue.labels(null, function(err, labels) {
        for (var i = 0; i < labels.length; i++) {
          var epic = labels[i].name.match(StoryMap.metaRegexp);
          if (epic != null) {
            StoryMap.epicsList.push({name:epic[0], color:labels[i].color});
          }
        }
        StoryMap.epicsList.push({name:'unspecified', color:'F5F5F5'});
        dfd.resolve();
      });
      return dfd.promise();
    },
    __populateSprintsList: function(issue) {
      StoryMap.sprintsList = []
      var dfd = $.Deferred();
      issue.milestones({state: StoryMap.githubStates['OPEN']}, function(err, sprintObjs) {
        var openSprintObjs = sprintObjs;
        issue.milestones({state: StoryMap.githubStates['CLOSED']}, function(err, sprintObjs) {
          var closedSprintObjs = sprintObjs;
          var allSprintObjs = closedSprintObjs.concat(openSprintObjs).sort(StoryMap.__compareSprints);
          for (var i = 0; i < allSprintObjs.length; i++) {
            StoryMap.sprintsList.push({name:allSprintObjs[i].title, id:allSprintObjs[i].number});
          }
          StoryMap.sprintsList.push({name:'backlog', id:-1});
          dfd.resolve();
        });
      });
      return dfd.promise();
    },
    __populateStoriesList: function(issue) {
      StoryMap.storiesList = [];
      var dfd = $.Deferred();
      issue.list({state:StoryMap.githubStates['OPEN'], labels:StoryMap.labels.STORY}, function(err, stories) {
        StoryMap.__addStoriesToList(stories);

        issue.list({state:StoryMap.githubStates['CLOSED'], labels:StoryMap.labels.STORY}, function(err, stories) {
          StoryMap.__addStoriesToList(stories);
          dfd.resolve();
        });
      });
      return dfd.promise();
    },
    __addStoriesToList: function(stories) {
      for (var i = 0; i < stories.length; ++i) {
        var story = stories[i];
        StoryMap.storiesList.push(StoryMap.__createStory(story));
      }
    },
    __getStoryState: function(story) {
      if (story.state == StoryMap.githubStates.CLOSED) {
        return {state:"closed", color:"D9534F"};
      }
      for (var i = 0; i < story.labels.length; ++i) {
        var label = story.labels[i];
        if (label.name == StoryMap.labels.IN_PROGRESS) {
          return {state:StoryMap.labels.IN_PROGRESS, color:label.color};
        }
        else if (label.name == StoryMap.labels.BLOCKED) {
          return {state:StoryMap.labels.BLOCKED, color:label.color};
        }
      }
      if (story.state == StoryMap.githubStates.OPEN) {
        return {state:"open", color:"5CB85C"};
      }
      return {state:"open", color:"5CB85C"};
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
    __getEpicObject: function(epicName) {
      for (var i = 0; i < StoryMap.epicsList.length; ++i) {
        if (StoryMap.epicsList[i].name == epicName) {
          return StoryMap.epicsList[i];
        }
      }
      return {};
    },
    __convertToMetaDataString: function(string) {
      if (string === null)
        return ""
      return "[" + string + "]";
    },
     __removeMetaDataStrings: function(string) {
      if (string === null)
        return ""
      return string.replace(/\[(\w+:\s[^\]]+)]/g, "").replace(/^\r?\n|\r$/g, "");
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
