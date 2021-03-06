(function () {
  "use strict";
  if (typeof jQuery === 'undefined') {
    console.log("StoryMap requires jQuery");
    return;
  }

  if (typeof Github === 'undefined') {
    console.log("StoryMap requires Github.js");
    return;
  }

  var config = {
    base_uri: window.location.origin + '/',
    callback_uri: window.location.origin + '/auth/'
  }
  if (window.StoryMap) {
    return;   
  }
  /**
    Generation of the storymap object that controls the entire storymap application. 
    @namespace StoryMap
    @global 
  */
  window.StoryMap = {
    github: null,
    config: config,
    userinfo: null,
    githubStates: {OPEN: "open", CLOSED: "closed"},
    states: [{state: "closed", color: "D9534F", verb: 'Close'}, {state: "open", color: "5CB85C", verb: 'Open'}],
    costs: ['1', '2', '3', '5', '8', '13', '20', '40', '100'],
    priorities: ['1', '2', '3', '4', '5'],
    labels: {IN_PROGRESS: "in progress", BLOCKED: "blocked", STORY: "story"},
    metadata: {COST: "SP", PRIORITY: "Priority", START: "Start"},
    metaRegexp: /[^[\]]+(?=])/g,
    metaDelimiter: ": ",
    epicsList: [],
    sprintsList: [],
    storiesList: [],
    assigneesList: [],
    labelsList: [],
    /**
      Initialization of the Github.js object which is used to 
      communicate with the github.com API.

      @method __gitinit
      @summary Github.js Object initialization.
      @returns {boolean} If the Github.js object has been created.
      @memberof StoryMap  
    */
    __gitinit: function() {
      var access_token = StoryMap.util.cookie.__read('access_token');
      if (access_token != null) {
        if (StoryMap.github === null) {
          StoryMap.github = new Github({
              token: access_token,
              auth: "oauth"
            });
        }
        return true;
      } else {
        document.location.href = "/";
        return false;
      }
    },
    /**
      Loads the github user information into an internal property (StoryMap.userinfo).
      Also updates the navagation bar with the users name and avatar.
      @method user  
      @summary Loads the github users information.
      @param {string} username - Github login username
      @memberof StoryMap  
    */
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
    /**
      Loads all the projects the authenticated user has access to and displays it
      in a list on the /#/projects route.

      @method projects
      @summary Loads the projects list page
      @param {string} username - Github login name
      @memberof StoryMap 
    */
    projects: function(username) {
      if (StoryMap.__gitinit()) {
        var project_tmpl = Handlebars.getTemplate('project_select'),
            context = { project:[]},
            user = StoryMap.github.getUser(),
            usrRepo = $.Deferred(),
            orgRepo = $.Deferred(),
            // Callback for loading the users repositories 
            repolist = function(err, repos) {
              for (var i = repos.length - 1; i >= 0; i--) {
                context.project.unshift({
                  name: repos[i].name,
                  link: config.base_uri+'#/storymap/'+repos[i].owner.login+'/repo/'+repos[i].name
                });
              };
              usrRepo.resolve();             
            },
            // Call back for loading organization repositiories the user has access to.
            orgList = function(err, orgs) {
              if (err) { orgRepo.resolve(); }
              var reposdfd = {};
              for (var i = orgs.length - 1; i >= 0; i--) {
                var orgname = orgs[i].login; 
                reposdfd[orgname] = $.Deferred();
                reposdfd[orgname].promise();
                user.orgRepos(orgname, function(orgtitle, err, repos) {
                    for (var j = repos.length - 1; j >= 0; j--) {
                      context.project.push({
                        name: repos[j].name,
                        org: orgtitle,
                        link: config.base_uri+'#/storymap/'+repos[j].owner.login+'/repo/'+repos[j].name
                      });
                    }
                    reposdfd[orgtitle].resolve();  
                  });
              };
              var dfds = [];
              for (var key in reposdfd) {
                dfds.push(reposdfd[key]);
              };

              $.when.apply($, dfds).done(function() {
                orgRepo.resolve();
              });                
            };
        usrRepo.promise();
        orgRepo.promise();
        if (username) {
          user.userOrgs(username, orgList);
          user.userRepos(username, repolist);          
        } else {
          user.orgs(orgList);          
          user.repos(repolist);
        }
        $.when(usrRepo, orgRepo).done( function() {          
          $('#content').html(project_tmpl(context));
          StoryMap.user();   
        }); 
      } else {
        routie('');
      }
    },
    /**
      Login request to the github api. This is the first step in the oauth process
      where the user is directed to the github site to confirm authentication and 
      access to the 
      @method login
      @summary First step in the oauth process, authenticate with github
      @memberof StoryMap 
    */
    login: function() {
      var request = {
        client_id: StoryMap.util.cookie.__read('clientid'),
        redirect_uri: config.callback_uri,
        state: StoryMap.util.__generateId(20),
        scope: 'user,repo'
      };
      StoryMap.util.cookie.__create('auth_state', request.state);
      var url = 'https://github.com/login/oauth/authorize?' + StoryMap.util.uri.__encode(request);
      document.location.href = url;
    },
    /**
      Third step in the oauth process where the code returned by the user authenticating
      with github is posted to our server to retrive the oauth token from github using 
      the servers public and private keys. 

      @method oauth
      @summary Github.com authentication callback that directs us to retrive the oauth token 
      @param {string} code A unique code provide by github.com
      @memberof StoryMap 
    */
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
            var token = StoryMap.util.cookie.__read('access_token')       
            StoryMap.github = new Github({
              token: token,
              auth: "oauth"
            });
          }
        },
        'json'
      ));
    },
    /**
      Main call for populating the Story Map with github issues.
      @method issues
      @param {string} user Github username 
      @param {string} project The selected project to load
      @memberof StoryMap 
    */
    issues: function(user, project) {
      StoryMap.__setupProject();
      StoryMap.user();
      if (StoryMap.__gitinit()) {
        var issue = StoryMap.issue = StoryMap.github.getIssues(user, project);
        $.when(StoryMap.__initMetaLabels(issue)).done(function() {
          // Populating the story map
          var haveAssignees = StoryMap.__populateAssigneesList(issue);
          var haveEpics = StoryMap.__populateEpicsList(issue);
          var haveSprints = StoryMap.__populateSprintsList(issue);
          var haveStories = StoryMap.__populateStoriesList(issue);
          var haveLabels = StoryMap.__populateLabelsList(issue);
          $.when(haveAssignees, haveEpics, haveSprints, haveStories, haveLabels).done(function() {
            StoryMap.__populateStateList(StoryMap.labelsList);
            StoryMap.__setupSprintModal(issue);
            StoryMap.__setupEpicModal(issue);
            StoryMap.__setupCreateStoryModal(issue);
            StoryMap.__setupFiltersModal();
            StoryMap.__setupMapListeners();
            StoryMap.__renderMap();
          });
        });        
      } else {
        routie('');
      }
    },
    /**
      Intialization call to verify basic meta-data exists
      @method __initMetaLabels
      @param {Github.issue} Github issue namespace.
      @memberof StoryMap 
    */
    __initMetaLabels: function(issue) {
      var 
        init = $.Deferred(),
        labels = [{"name": "story", "color": "0052cc"}, 
            {"name": "in progress", "color": "207de5"}, 
            {"name": "blocked", "color": "e11d21"}],
        dfds = [];

      for (var i = labels.length - 1; i >= 0; i--) {                
        dfds.push(StoryMap.__initMetaLabel(issue, labels[i]));        
      };

      $.when.apply($, dfds).done(function() {
        init.resolve();
      });  

      return init.promise();      
    },
    __initMetaLabel: function(issue, label) {
      var dfd = $.Deferred();
      issue.label(label.name, function(err, res) {
        if (res && res.message === "Not Found") { 
          issue.createLabel(label, function(err, res) {
            dfd.resolve();
          }); 
        } else {
          dfd.resolve();
        }
      }); 
      return dfd.promise();
    },
    /**
      Intialization call for the story map that loads in the base template.
      @method __setupProject
      @memberof StoryMap 
    */
    __setupProject: function() {
      NProgress.start();
      $('#content').html(Handlebars.getTemplate('project'));
    },
    /**
      Controller method that posts a new comment to a github issue using the Github.js object.
      @method __addComment
      @param id Github issue id
      @memberof StoryMap 
    */
    __addComment: function(id) {
      $('#newCommentBtn').click(function (argument) {
        var text = $('#newComment').val();
        if (text !== "") {
          NProgress.start();
          StoryMap.issue.addComment(id, {"body": text}, function (err, comment) {
            if (comment) {
              StoryMap.__loadComments(id);
            }
            NProgress.done();
          });
        }
      });
    },
    /**
      Method to retrive the comments of an issue into the issue modal. Also adds
      a listener on each that will delete the issue.  
      @method __loadComments
      @summary Retrive the comments of an issue into the issue modal. 
      @param {integer} id Github issue id
      @returns {Deferred} Promise for when the comments have loaded 
      @memberof StoryMap 
    */
    __loadComments: function (id) {
      if (StoryMap.__gitinit() && StoryMap.issue) {
        var dfd = $.Deferred();
        NProgress.start();
        StoryMap.issue.issueComments(id, null, function(err, comments) {
          $('#storyCollapse').html(Handlebars.getTemplate('story_modal_comments')({"comments":comments}));
          StoryMap.__addComment(id);
          $('span.comment-delete').click(function (argument) {
            NProgress.start();
            var commentId = $(this).attr('id');
            StoryMap.issue.deleteComment(commentId, null, function (err, res) {
              if (err) {
                console.log(err);
              } else {
                StoryMap.__loadComments(id);    
              }
              NProgress.done();
            });
          });
          NProgress.done();
          dfd.resolve();
        });
        return dfd.promise();
      }
    },
    /**
      Method to retrive the events (open, close, change in assignee) of an issue into the issue modal.
      @method __loadEvents
      @summary Retrive the events of an issue into the issue modal. 
      @param {integer} id Github issue id
      @returns {Deferred} Promise for when the event stream has loaded 
      @memberof StoryMap 
    */
    __loadEvents: function (id) {
      if (StoryMap.__gitinit() && StoryMap.issue) {
        var dfd = $.Deferred();
        NProgress.start();
        StoryMap.issue.issueEvents(id, null, function(err, events) {
          $('#storyCollapse').html(Handlebars.getTemplate('story_modal_events')({"events":events}));
          NProgress.done();
          dfd.resolve();
        });
        return dfd.promise();
      }
    },
    /**
      Submission method on the Story modal that updates an edited issue and posts it
      to github. The github response is used to do an inplace replacment of the story
      in the internal mapping. 
      @method __updateStory
      @summary Story modal submit to github.
      @param {integer} id The github issue id
      @param el Dom element
      @memberof StoryMap 
    */
    __updateStory: function (id, el) {
      NProgress.start();
      var form = $('#story-form').serializeArray();
      var data = {body:"", labels:[]};
      for (var i = form.length - 1; i >= 0; i--) {
        NProgress.inc();
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
        } else if(obj.name === "milestone") {
          if (obj.value != -1) {
            data["milestone"] = obj.value
          }
        } else {
          data[obj.name] = obj.value;
        }
      };
      data.labels.push("story");
      NProgress.inc();
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
            StoryMap.__loadStoryModal(story);
            StoryMap.__renderMap();
          } else {
            console.log(err);
          }
          NProgress.done();
        });
      }
    },
    /**
      Method call that rebuilds an internal story with the new state and updates it
      against Github. The Github response is paresed and updates the internal map.
      @method __updateStoryState
      @summary Change the state of a Github issue.
      @param {integer} id Github issue id.
      @param {string} state Issue state one of; open, closed, in progress, blocked 
      @memberof StoryMap 
    */
    __updateStoryState: function(id, state) {
      var obj = $.grep(StoryMap.storiesList, function(e){ return e.number == id; })[0];
      var data = {title:obj.name, state:StoryMap.githubStates.OPEN, labels:[]};
      if (StoryMap.__gitinit() && StoryMap.issue) {
        for (var i = obj.labels.length - 1; i >= 0; i--) {
          data.labels.push(obj.labels[i].name);
        };
        if (obj.epic !== null && obj.epic.toLowerCase() !== "unspecified") {
          data.labels.push(StoryMap.__convertToMetaDataString(obj.epic));
        }
        if (state == StoryMap.githubStates.CLOSED) {
          data.state = StoryMap.githubStates.CLOSED;
        } else if (state == StoryMap.labels.IN_PROGRESS) {
          data.labels.push(StoryMap.labels.IN_PROGRESS);
        } else if (state == StoryMap.labels.BLOCKED) {
          data.labels.push(StoryMap.labels.BLOCKED);
        }
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
            StoryMap.__loadStoryModal(story);
            StoryMap.__renderMap();
          } else {
            console.log(err);
          }
          NProgress.done();
        });
      }
    },
    /**
      Method that removes a label from a story (Github issue) by updating the internal 
      mapping and updates it on Github.

      @method __deleteStoryLabel
      @summary Removes a label from a story.
      @param {integer} id Github issue id.
      @param {string} name Label name.
      @param {boolean} modal Flag to indicate if this was triggered from a modal.
      @memberof StoryMap 
    */
    __deleteStoryLabel: function (id, name, modal) {
      var obj = $.grep(StoryMap.storiesList, function(e){ return e.number == id; })[0];
      StoryMap.issue.deleteLabelIssue(obj.number, [name], function (err, res) {
        if (err) {
          console.log(err);
        } else {
          for (var i = obj.labels.length - 1; i >= 0; i--) {
            if (obj.labels[i].name === name) {
              obj.labels.splice(i, 1);
              break;
            }
          }
          if (modal) { 
            StoryMap.__loadStoryModal(obj); 
            StoryMap.__renderMap();
          }
            
        }
      });
    },
    /**
      Adds a specific label to a story by calling github with the name (data.name)
      and updating it against github.
      @method __updateStoryLabels
      @summary Add a label to a story.
      @param {integer} id Github issue id.
      @param {object} data representing a label {name:'', color:''}.
      @param {boolean} modal Flag to indicate if this was triggered from a modal.
      @memberof StoryMap 
    */
    __updateStoryLabels: function (id, data, modal) {
      var obj = $.grep(StoryMap.storiesList, function(e){ return e.number == id; })[0];
      StoryMap.issue.addLabelsIssue(obj.number, [data.name], function (err, res) {
        if (err) {
          console.log(err);
        } else {
          obj.labels.push(data);
          if (modal) { 
            StoryMap.__loadStoryModal(obj); 
            StoryMap.__renderMap();
          }
        }
      });
    },
    /**
      This adds a label to a story by first checking if the label exists, if it does 
      StoryMap.__updateStoryLabels is used. Otherwise the label is created and added 
      to the internal label list. 
      @method __addLabelToIssue
      @summary Method that adds a label to a story, creating it if necessary.  
      @param {integer} id Github issue id. 
      @memberof StoryMap 
    */
    __addLabelToIssue: function (id) {
      if (StoryMap.__gitinit() && StoryMap.issue) {
        var labelName = $('#labellist').val();
        var data = { name:labelName, color:$('#newLabelColorInput').val().replace('#', '')};
        var notInArray = true;
        for (var i = StoryMap.labelsList.length - 1; i >= 0; i--) {
          if(StoryMap.labelsList[i].name === data.name) {
            notInArray = false;
          }
        };
        if (notInArray) {
          StoryMap.issue.createLabel(data, function (err, res) {            
            if (err) {
              console.log(err);
            } else {
              StoryMap.labelsList.push(data);
              StoryMap.__updateStoryLabels(id, data, true);
            }
          });
        } else {
          StoryMap.__updateStoryLabels(id, data, true);
        }
      }
    },
    /**
      Helper function for StoryMap.__loadStoryModal that looks the story from 
      the internal story mapping.

      @method __loadStory
      @summary Loads the story modal popup
      @param el Dom element 
      @memberof StoryMap 
    */
    __loadStory: function(el) {
      var id = $(el).attr('id');
      var obj = $.grep(StoryMap.storiesList, function(e){ return e.number == id; })[0];
      StoryMap.__loadStoryModal(obj);
    },
    /**
      Heavy method that loads the story modal with data from the story object. 
      This includes click listeners and the Bloodhound label drop down setup.
      @method __loadStoryModal
      @summary Loads the story modal
      @param {object} obj Object representing a Story (github issue)
      @memberof StoryMap 
    */
    __loadStoryModal: function(obj) {  
      var context = {}, id = obj.number;
      for (var prop in obj) {
        context[prop] = obj[prop];
      }
      context.states = StoryMap.states;
      context.sprints = StoryMap.sprintsList;
      context.costs = StoryMap.costs;
      context.assignees = StoryMap.assigneesList;
      context.priorities = StoryMap.priorities;
      context.epics = StoryMap.epicsList;
      context.epic = StoryMap.__getEpicObject(obj.epic);
      context.body = StoryMap.__removeMetaDataStrings(obj.body);
      $('#storyModal').html(Handlebars.getTemplate('story_modal')(context));
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
        $(this).attr('state', newstate);
      });
      var labels = new Bloodhound({
        datumTokenizer: function(d) { return Bloodhound.tokenizers.whitespace(d.name); },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        local: StoryMap.labelsList
      });
      labels.initialize();
      $('#labellist').typeahead(null, {highlight: true, source: labels.ttAdapter(), displayKey: 'name'});
      $('#labellist').on('typeahead:selected', null, function(event, obj, dataset) {
        $('#labellist').css('background-color', '#'+obj.color);
        $('#newLabelColorInput').val('#'+obj.color);
        $('#labellist').css('color', '#fff');
      });
      $('#labellist').on('typeahead:autocompleted', null, function(event, obj, dataset) {
        $('#labellist').css('background-color', '#'+obj.color);
        $('#newLabelColorInput').val('#'+obj.color);
        $('#labellist').css('color', '#fff');
      });
      $('#labellist').on('typeahead:open', null, function(event) {
        $('#labellist').css('background-color', '#fff');
        $('#newLabelColorInput').val('#fff');
        $('#labellist').css('color', '#000');
      });
      $('#labellist').on('typeahead:cursorchanged', null, function(event, obj, dataset) {
        $('#labellist').css('background-color', '#'+obj.color);
        $('#newLabelColorInput').val('#'+obj.color);
        $('#labellist').css('color', '#fff');
      });
      $('#newLabelColor').click(function(event) {
        $('#newLabelColorInput').colorpicker('show');
      });
      $('#newLabelColorInput').colorpicker().on('changeColor', function(ev){
        $('#labellist').css('background-color', ev.color.toHex());
      });
      $('#newLabel').click(function(event) { 
        StoryMap.__addLabelToIssue(id);
      });
      $('.delete-label').click(function (event) {
        StoryMap.__deleteStoryLabel(id, $(this).attr('data-value'), true);
      })
      $('.btn-state').click(function(event) {
        var state = $(this).attr('value');
        StoryMap.__updateStoryState(id, state, obj.title);
      });
      $('#storySubmit').click(function(event) {
        StoryMap.__updateStory(id, this);
      });
      $('#storyComments').click(function() {
        if ( $('#storyCollapse').attr('state') !== '1' ) {
          $('#storyCollapse').attr('state', '1');
          var commentsLoaded = StoryMap.__loadComments(id);
          $.when(commentsLoaded).done(function() {
              $('#storyCollapse').show();
          });
        } else {
          $('#storyCollapse').attr('state', '0');
          $('#storyCollapse').hide();
        }
      });
      $('#storyEvents').click(function() {
        if ( $('#storyCollapse').attr('state') !== '2' ) {
          $('#storyCollapse').attr('state', '2');
          var eventsLoaded = StoryMap.__loadEvents(id);
          $.when(eventsLoaded).done(function() {
            $('#storyCollapse').show();
          });
        } else {
          $('#storyCollapse').attr('state', '0');
          $('#storyCollapse').hide();
        }
      });
    },
    /**
      Loads the create epic modal 
      @method __loadCreateEpicModal
      @summary Loads the create epic modal.
      @param {Github.issue} Github issue namespace.
      @memberof StoryMap
    */
    __loadCreateEpicModal: function(issue) {
      $('#epicLabel').html('Create Feature');
      $('#epicBtn').text('Create');
      $('#epicModal').off('click', '#epicBtn');
      $('#epicModal').on('click', '#epicBtn', function() {
        var valid = StoryMap.__validateRequiredFields('#epicModal');
        if (valid) {
          $('#epicModal').modal('hide');
	      var data = StoryMap.__parseEpicModalFields();
	      issue.createLabel(data, function(err, createdEpic) {
	        var repopulatedEpics = StoryMap.__populateEpicsList(issue);
	        $.when(repopulatedEpics).done(function() {
	          StoryMap.__resetStoryModal();
	          StoryMap.__renderMap();
	        });
	      });
        }
      });
    },
    /**
      Loads the edit epic modal
      @method __loadEditEpicModal
      @summary Loads the edit epic modal.
      @param el Dom element of the epic to be loaded
      @memberof StoryMap
    */
    __loadEditEpicModal: function(el) {
      var id = $(el).attr('id');
      var obj = $.grep(StoryMap.epicsList, function(e){ return e.id == id; })[0];
      if (obj.name == "unspecified") {
        return;
      }
      $('#epicLabel').html('Edit Feature');
      $('#epicName').val(obj.name);
      $('#epicColour').val('#'+obj.color);
      $('#epicColour').colorpicker('setValue', '#'+obj.color);
      $('#epicBtn').text('Update');
      $('#epicModal').modal();
      $('#epicModal').off('click', '#epicBtn');
      $('#epicModal').on('click', '#epicBtn', function() {
        var valid = StoryMap.__validateRequiredFields('#epicModal');
        if (valid) {
          $('#epicModal').modal('hide');
          var data = StoryMap.__parseEpicModalFields();
          StoryMap.issue.updateLabel(StoryMap.__convertToMetaDataString(obj.name), data, function(err, updatedLabel) {
            if (updatedLabel) {
              var epic = StoryMap.__createEpic(updatedLabel);
              for (var i = 0; i < StoryMap.epicsList.length; ++i) {
                if (StoryMap.epicsList[i].name == obj.name) {
                  StoryMap.epicsList[i] = epic;
                  break;
                }
              }
              StoryMap.__renderMap();
            }
          });
        }
      });
    },
    /**
      Parse the input fields within the epic modal
      @method __parseEpicModalFields
      @summary Parse the input fields within the epic modal
      @returns {Object} Object containing the parsed values
      @memberof StoryMap
    */
    __parseEpicModalFields: function() {
      var data = {}
      var name = $("#epicName").val();
      var colour = $("#epicColour").val();
      data.name = StoryMap.__convertToMetaDataString(name);
      data.color = colour.replace("#", "");
      return data;
    },
    /**
      Create a StoryMap story object from a GitHub issue JSON object
      @method __createStory
      @summary Create a StoryMap story object from a GitHub issue JSON object
      @param {Object} story A GitHub issue JSON object
      @returns {Object} A StoryMap story object
      @memberof StoryMap
    */
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
    /**
      Create a StoryMap epic object from a GitHub label JSON object
      @method __createEpic
      @summary Create a StoryMap epic object from a GitHub label JSON object
      @param {Object} epic A GitHub epic JSON object
      @returns {Object} A StoryMap epic object
      @memberof StoryMap
    */
    __createEpic: function(epic) {
      var epicName = epic.name.match(StoryMap.metaRegexp)[0];
      var epicId = epicName.replace(/\s/g, "");
      var epicColor = epic.color;
      return {name: epicName, id: epicId, color: epicColor};
    },
    /**
      Create a StoryMap sprint object from a GitHub milestone JSON object
      @method __createSprint
      @summary Create a StoryMap sprint object from a GitHub milestone JSON object
      @param {Object} sprint A GitHub milestone JSON object
      @returns {Object} A StoryMap sprint object
      @memberof StoryMap
    */
    __createSprint: function(sprint) {
      var description = StoryMap.__parseSprintDescription(sprint);
      return {
        name: sprint.title,
        id: sprint.number,
        description: sprint.description,
        start: description.start,
        due: sprint.due_on
      };
    },
    /**
      Loads the create sprint modal 
      @method __loadCreateSprintModal
      @summary Loads the create sprint modal.
      @param {Github.issue} Github issue namespace.
      @memberof StoryMap
    */
    __loadCreateSprintModal: function(issue) {
      $('#sprintLabel').html('Create Sprint');
      $('#sprintBtn').text('Create');
      $('#sprintModal').off('click', '#epicBtn');
      $('#sprintModal').on('click', '#sprintBtn', function() {
        var valid = StoryMap.__validateRequiredFields('#sprintModal');
        if (valid) {
          $('#sprintModal').modal('hide');
          var data = StoryMap.__parseSprintModalFields();
          issue.createMilestone(data, function(err, createdSprint) {
            var repopulatedSprints = StoryMap.__populateSprintsList(issue);
            $.when(repopulatedSprints).done(function() {
              StoryMap.__resetStoryModal();
              StoryMap.__renderMap();
            });
          });
        }
      });
    },
    /**
      Loads the edit sprint modal
      @method __loadEditSprintModal
      @summary Loads the edit sprint modal.
      @param el Dom element of the sprint to be loaded
      @memberof StoryMap
    */
    __loadEditSprintModal: function(el) {
      var id = $(el).attr('id').split("-")[1];
      var obj = $.grep(StoryMap.sprintsList, function(e){ return e.id == id; })[0];
      if (obj.name == "backlog") {
        return;
      }
      $('#sprintLabel').html('Edit Sprint');
      $('#sprintTitle').val(obj.name);
      $('#sprintDesc').val(StoryMap.__removeMetaDataStrings(obj.description));
      $('#sprintStartDate').datepicker('setValue', obj.start)
      $('#sprintStartDate').val(obj.start);
      var dueDate = obj.due ? Date.parse(obj.due) : '';
      $('#sprintDueDate').val(dueDate);
      $('#sprintDueDate').datepicker('setValue', dueDate);
      $('#sprintBtn').text('Update');
      $('#sprintModal').modal();
      $('#sprintModal').off('click', '#sprintBtn');
      $('#sprintModal').on('click', '#sprintBtn', function() {
        var valid = StoryMap.__validateRequiredFields('#sprintModal');
        if (valid) {
          $('#sprintModal').modal('hide');
	      var data = StoryMap.__parseSprintModalFields();
	      StoryMap.issue.editMilestone(id, data, function(err, updatedSprint) {
	        if (updatedSprint) {
	          var sprint = StoryMap.__createSprint(updatedSprint);
	          for (var i = 0; i < StoryMap.sprintsList.length; ++i) {
	            if (StoryMap.sprintsList[i].id == id) {
	              StoryMap.sprintsList[i] = sprint;
	              break;
	            }
	          }
	          StoryMap.__renderMap();
	        }
	      });
        }
      });
    },
    /**
      Parse the input fields within the sprint modal
      @method __parseSprintModalFields
      @summary Parse the input fields within the sprint modal
      @returns {Object} Object containing the parsed values
      @memberof StoryMap
    */
    __parseSprintModalFields: function() {
      var data = {};
      var start = $("#sprintStartDate").val();
      var due = $("#sprintDueDate").val();
      var desc = $("#sprintDesc").val();
      var body = "";
      if (start) {
        body += StoryMap.__convertToMetaDataString(
          StoryMap.metadata.START + StoryMap.metaDelimiter + start) + "\n";
      }
      body += desc;

      data.title = $("#sprintTitle").val();
      data.description = body;
      data.due_on = due + "T00:00:00Z";

      return data;
    },
    /**
      Validate that the required fields within the element are filled
      @method __validateRequiredFields
      @summary Validate that the required fields within the element are filled.
      @param element Dom element with the input fields to be validated
      @returns {Boolean} True if all required fields are filled, otherwise false
      @memberof StoryMap 
    */
    __validateRequiredFields: function(element) {
      var valid = true;
      $(element).find('.required').each(function() {
        if (!$(this).val()) {
          valid = false;
          $(this).parent().closest('div').addClass('has-error');
        }
        else {
          $(this).parent().closest('div').removeClass('has-error');
        }
      });
      if (valid) {
        return true;
      }
      return false;
    },
    /**
      Setup the sprint modal
      @method __setupSprintModal
      @summary Setup the sprint modal.
      @param {Github.issue} Github issue namespace.
      @memberof StoryMap 
    */
    __setupSprintModal: function(issue) {
      $('#sprintStartDate').datepicker({format: "yyyy-mm-dd"});
      $('#sprintDueDate').datepicker({format: "yyyy-mm-dd"});
      $('#story-map').on('click', '#createSprintBtn', function() {StoryMap.__loadCreateSprintModal(issue)});
      $('#story-map').on('click', '.edit-sprint', function(event) {
        event.preventDefault();
        StoryMap.__loadEditSprintModal(this);
      });
      $('#sprintModal').on('hidden.bs.modal', function() {
        $("#sprintTitle").val("");
        $("#sprintDesc").val("");
        $("#sprintStartDate").val("");
        $("#sprintDueDate").val("");
        $(this).find('.has-error').each(function() {
          $(this).removeClass('has-error');
        });
      });
    },
    /**
      Setup the epic modal
      @method __setupEpicModal
      @summary Setup the epic modal.
      @param {Github.issue} Github issue namespace.
      @memberof StoryMap 
    */
    __setupEpicModal: function(issue) {
      $('#epicColour').colorpicker();
      $('#story-map').on('click', '#createEpicBtn', function() {StoryMap.__loadCreateEpicModal(issue)});
      $('#story-map').on('click', '.panel.epic', function() {StoryMap.__loadEditEpicModal(this)});
      $('#epicModal').on('hidden.bs.modal', function() {
        $("#epicName").val("");
        $("#epicColour").val("");
        $(this).find('.has-error').each(function() {
          $(this).removeClass('has-error');
        });
      });
    },
    /**
      Update the fields of the create story modal with the latest data
      @method __resetStoryModal
      @summary Update the fields of the create story modal with the latest data.
      @memberof StoryMap 
    */
    __resetStoryModal: function() {
      var modal_tmpl = Handlebars.getTemplate('create_story_modal');
      var context = {"assignees": StoryMap.assigneesList,
                     "priorities": StoryMap.priorities,
                     "costs": StoryMap.costs,
                     "sprints": StoryMap.sprintsList,
                     "epics": StoryMap.epicsList};
      $('#createStoryModal').html(modal_tmpl(context));
    },
    /**
      Setup the create story modal
      @method __setupCreateStoryModal
      @summary Setup the create story modal.
      @param {Github.issue} Github issue namespace.
      @memberof StoryMap 
    */
    __setupCreateStoryModal: function(issue) {
      StoryMap.__resetStoryModal();
      $('#createStoryModal').on('click', '#createStoryBtn', function() {
        var valid = StoryMap.__validateRequiredFields('#createStoryModal');
        if (valid) {
          $('#createStoryModal').modal('hide');
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
            labels.push(StoryMap.__convertToMetaDataString(epic));
          }
          body += desc;

          data.title = $("#createStoryTitle").val();
          data.body = body;
          data.assignee = $("#createStoryAssignee").val();
          data.milestone =  sprint < 0 ? null : sprint;
          data.labels = labels;

          issue.createIssue(data, function(err, createdStory) {
            if (createdStory) {
              StoryMap.storiesList.push(StoryMap.__createStory(createdStory));
              StoryMap.__renderMap();
            } else {
              console.log(err);
            }
          });
        }
      });
      $('#createStoryModal').on('hidden.bs.modal', function() {
        $("#createStoryTitle").val("");
        $("#createStoryDesc").val("");
        $("#createStoryPriority").val("");
        $("#createStoryPoints").val("");
        $("#createStoryAssignee").val("");
        $('#createStorySprint').val("");
        $('#createStoryEpic').val("");
        $(this).find('.has-error').each(function() {
          $(this).removeClass('has-error');
        });
      });
    },
    /**
      Setup the filters modal
      @method __setupFiltersModal
      @summary Setup the filters modal.
      @memberof StoryMap 
    */
    __setupFiltersModal: function() {
      var modal_tmpl = Handlebars.getTemplate('filters_modal');
      var context = {"states": StoryMap.states,
                     "assignees": StoryMap.assigneesList,
                     "priorities": StoryMap.priorities,
                     "costs": StoryMap.costs};
      $('#filtersModal').html(modal_tmpl(context));
      $('#filtersModal').on('click', '#clearFiltersBtn', function() {
        var inputFields = ["#filterEpicName", "#filterSprintName",
                           "#filterStoryName", "#filterStoryState",
                           "#filterStoryAssignee", "#filterStoryPriority",
                           "#filterStoryPoints"];
        for (var i = 0; i < inputFields.length; ++i) {
          $(inputFields[i]).val("");
        }
      });
      $('#filtersModal').on('click', '#applyFiltersBtn', function() {
        StoryMap.__renderMap();
      });
    },
    /**
      Setup the persistent map listeners
      @method __setupMapListeners
      @summary Setup the persistent map listeners
      @memberof StoryMap 
    */
    __setupMapListeners: function() {
      $('#story-map').on('click', '.story', function() {StoryMap.__loadStory(this)});
      $('#story-map').on('click', '.delete-epic', function() {
        var name = encodeURI(StoryMap.__convertToMetaDataString($(this).attr('data-value')));
        $('#confirmModal').modal('show');
        $('#confirmModal').off('click', '#confirmBtn');
        $('#confirmModal').on('click', '#confirmBtn', function() {
          $('#confirmModal').modal('hide');
          NProgress.start();
          StoryMap.issue.deleteLabel(name , null, function (err, res) {
            NProgress.set(0.60);
            var repopulatedEpics = StoryMap.__populateEpicsList(StoryMap.issue);
            $.when(repopulatedEpics).done(function() {
              StoryMap.__renderMap();
              NProgress.done();
            });
          });
        });
      });
      $('#story-map').on('click', '.delete-story', function() {
        var id = $(this).attr('data-value');
        $('#confirmModal').modal('show');
        $('#confirmModal').off('click', '#confirmBtn');
        $('#confirmModal').on('click', '#confirmBtn', function() {
          $('#confirmModal').modal('hide');
          NProgress.start();
          StoryMap.issue.deleteLabelIssue(id, "story", function (err, res) {
            NProgress.set(0.60);
            var repopulatedStories = StoryMap.__populateStoriesList(StoryMap.issue);
            $.when(repopulatedStories).done(function() {
              StoryMap.__renderMap();
              NProgress.done();
            });
          });
        });
      });
    },
    /**
      Setup the drag and drop feature of the map
      @method __setupDragAndDrop
      @summary Setup the drag and drop feature of the map.
      @memberof StoryMap 
    */
    __setupDragAndDrop: function () {
      var dragsource;
      $('.dd-drag').on('dragstart', function (e) {
        var id = $(this).attr('id');
        if (typeof id != 'undefined') {
          dragsource = this;
          var html = $(this).clone().wrap('<p>').parent().html();
          $(this).addClass('dragged');
          e.originalEvent.dataTransfer.effectAllowed = 'move';
          e.originalEvent.dataTransfer.setData('text/html', html);
        }
      });
      $('.dd-drag').on('dragend', function (e) {
        $(this).removeClass('dragged');
      });
      $('.dd-drop').on('dragover', function (e) {
        e.originalEvent.preventDefault()
        e.originalEvent.dataTransfer.dropEffect = 'move';
      });
      $('.dd-drop').on('dragenter', function (e) {
        $(this).addClass('over');
      });
      $('.dd-drop').on('dragleave', function (e) {
        $(this).removeClass('over');
      });
      $('.dd-drop').on('drop', function (e) {
        e.originalEvent.preventDefault();
        // e.originalEvent.stopPropagation();
        /* Act on the event */
        $(this).removeClass('over');
        var 
          id = $(dragsource).attr('id'),
          html = e.originalEvent.dataTransfer.getData('text/html');

        $(dragsource).remove();
        dragsource = null;

        var 
          milestoneid = $(this).attr('data-milestone'),
          epicpos = $(this).attr('data-epic'),
          epic = StoryMap.epicsList[epicpos],
          obj = $.grep(StoryMap.storiesList, function(e){ return e.number == id; })[0],
          milestone = $.grep(StoryMap.sprintsList, function(e){ return e.id == milestoneid; })[0];

        if (epic.name != obj.epic) {
          var oldEpic = obj.epic, newEpic = epic.name;
          obj.epic = epic.name;
          StoryMap.issue.deleteLabelIssue(obj.number, [StoryMap.__convertToMetaDataString(oldEpic)], function (err, res) {
            if (err) {
              console.log(err);
            } else {
              for (var i = obj.labels.length - 1; i >= 0; i--) {
                if (obj.labels[i].name === name) {
                  obj.labels.splice(i, 1);
                  break;
                }
              }
              StoryMap.issue.addLabelsIssue(id, [StoryMap.__convertToMetaDataString(newEpic)], function (err, res) {
                if (err) {
                  console.log(err);
                }
              });                
            }
          });
        } 

        if (obj.sprint != milestone.name) {
          obj.sprint = milestone.name;
          var data = {title: obj.name, milestone:milestoneid};
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
            } else {
              console.log(err);
            }
          });
        }
        $(this).append(html); 
        StoryMap.__renderMap();      
      });
    },
    /**
      Render the map using the cached StoryMap data
      @method __renderMap
      @summary Render the map using the cached StoryMap data.
      @memberof StoryMap 
    */
    __renderMap: function() {
      NProgress.start();
      var map_tmpl = Handlebars.getTemplate('map');
      var context = {epic: [], sprint: [], style:{}};
      var epicsMap = {};
      var sprintsMap = {};
      NProgress.set(0.20);
      StoryMap.__processEpics(epicsMap, context);
      NProgress.set(0.40);
      StoryMap.__processSprints(sprintsMap, context);
      NProgress.set(0.60);
      StoryMap.__processStories(epicsMap, sprintsMap, context);
      NProgress.set(0.80);
      for (var i = context.sprint.length - 1; i >= 0; i--) {
        var obj = context.sprint[i];
        obj.prc = (obj.claimedSP / obj.totalSP) * 100;
      };
      $('#story-map').html(map_tmpl(context));
      NProgress.done();
      StoryMap.__setupDragAndDrop();
      $('body').scrollspy({target: '#sprint-menu', offset:200});
      $(window).scroll(function(event) {
        var offset = ($('body').scrollLeft())*-1;
        $('#story-map-headers').css('margin-left', offset);
      });
      $('a.sprint-link').click(function (e) {
        e.preventDefault();
        $($(this).attr('href'))[0].scrollIntoView();
        scrollBy(0, -199);
      });
    },
    /**
      Process the cached StoryMap epics, and filter out where applicable
      @method __processEpics
      @summary Process the cached StoryMap epics, and filter out where applicable.
      @memberof StoryMap 
    */
    __processEpics: function(epicsMap, context) {
      context.style.innerwidth = StoryMap.epicsList.length * 150;
      context.style.width = context.style.innerwidth + 50;

      var numEpics = 0;
      var nameFilter = $("#filterEpicName").val();
      for (var i = 0; i < StoryMap.epicsList.length; ++i) {
        var epic = StoryMap.epicsList[i];
        if (!nameFilter || nameFilter == epic.name || epic.name == "unspecified") {
          epicsMap[epic.name] = numEpics;
          context.epic.push({name:epic.name, id:epic.id, color:epic.color});
          ++numEpics;
        }
      }
    },
    /**
      Process the cached StoryMap sprints, and filter out where applicable
      @method __processSprints
      @summary Process the cached StoryMap sprints, and filter out where applicable.
      @memberof StoryMap 
    */
    __processSprints: function(sprintsMap, context) {
      var numSprints = 0,
        nameFilter = $("#filterSprintName").val(),
        date = Date();
      for (var i = 0; i < StoryMap.sprintsList.length; ++i) {
        var sprint = StoryMap.sprintsList[i];
        if (!nameFilter || nameFilter == sprint.name || sprint.name == "backlog") {
          sprintsMap[sprint.name] = numSprints;
          var sprintObj = {name: sprint.name, id:sprint.id, epic: [], prc:0,
                           claimedSP: 0, totalSP: 0, closed: false, assignees: []};
          for (var j = 0; j < context.epic.length; ++j) {
            sprintObj.epic.push([]);
          }

          sprintObj.closed = sprint.due ? Date.parse(sprint.due).valueOf() < Date.parse(date).valueOf() : false;
          context.sprint.push(sprintObj);
          ++numSprints;
        }
      }
    },
    /**
      Process the cached StoryMap stories, and filter out where applicable
      @method __processStories
      @summary Process the cached StoryMap stories, and filter out where applicable.
      @memberof StoryMap 
    */
    __processStories: function(epicsMap, sprintsMap, context) {
      var nameFilter = $("#filterStoryName").val();
      var stateFilter = $("#filterStoryState").val();
      var assigneeFilter = $("#filterStoryAssignee").val();
      var priorityFilter = $("#filterStoryPriority").val();
      var costFilter = $("#filterStoryPoints").val();
      for (var i = 0; i < StoryMap.storiesList.length; ++i) {
        var story = StoryMap.storiesList[i];
        var storySprint = sprintsMap[story.sprint];
        var storyEpic = epicsMap[story.epic];
        if (typeof(storySprint) != "undefined" && typeof(storyEpic) != "undefined") {
          if ((!nameFilter || nameFilter == story.name) &&
              (!stateFilter || stateFilter == story.state.state) &&
              (!assigneeFilter || assigneeFilter == story.assignee.name) &&
              (!priorityFilter || priorityFilter == story.priority) &&
              (!costFilter || costFilter == story.cost)) {
            if (!StoryMap.__assigneeInSprint(story.assignee, context.sprint[storySprint])) {
              context.sprint[storySprint].assignees.push(story.assignee);
            }
            var storyCost = null;
            if (!story.cost) {
              storyCost = 0;
            } else {
              storyCost = parseInt(story.cost);
            }
            context.sprint[storySprint].totalSP += storyCost;
            if (story.state.state.toLowerCase() === StoryMap.githubStates['CLOSED'].toLowerCase()) {
              context.sprint[storySprint].claimedSP += storyCost;
            }
            context.sprint[storySprint].epic[storyEpic].push(story);
          }
        }
      }
    },
    /**
      Retrieve the list of assignees for a repository
      @method __populateAssigneesList
      @summary Retrieve the list of assignees for a repository.
      @param {Github.issue} Github issue namespace.
      @returns {Deferred} Promise for when the assignees have been retrieved 
      @memberof StoryMap
    */
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
    /**
      Retrieve the list of labels for a repository
      @method __populateLabelsList
      @summary Retrieve the list of labels for a repository.
      @param {Github.issue} Github issue namespace.
      @returns {Deferred} Promise for when the labels have been retrieved 
      @memberof StoryMap 
    */
    __populateLabelsList: function(issue) {
      StoryMap.labelsList = [];
      var dfd = $.Deferred();
      issue.labels(null, function(err, labels) {
        StoryMap.labelsList = labels;
        dfd.resolve();
      });
      return dfd.promise();
    },
    /**
      Retrieve the list of epics for a repository
      @method __populateEpicsList
      @summary Retrieve the list of epics for a repository.
      @param {Github.issue} Github issue namespace.
      @returns {Deferred} Promise for when the epics have been retrieved 
      @memberof StoryMap 
    */
    __populateEpicsList: function(issue) {
      StoryMap.epicsList = [];
      var dfd = $.Deferred();
      issue.labels(null, function(err, labels) {
        for (var i = 0; i < labels.length; i++) {
          var label = labels[i];
          if (label.name.match(StoryMap.metaRegexp) != null) {
            StoryMap.epicsList.push(StoryMap.__createEpic(label));
          }
        }
        StoryMap.epicsList.push({name:'unspecified', id:'unspecified', color:'F5F5F5'});
        dfd.resolve();
      });
      return dfd.promise();
    },
    /**
      Retrieve the list of sprints for a repository
      @method __populateSprintsList
      @summary Retrieve the list of sprints for a repository.
      @param {Github.issue} Github issue namespace.
      @returns {Deferred} Promise for when the sprints have been retrieved 
      @memberof StoryMap 
    */
    __populateSprintsList: function(issue) {
      StoryMap.sprintsList = []
      var dfd = $.Deferred();
      issue.milestones({state: StoryMap.githubStates['OPEN']}, function(err, sprintObjs) {
        var openSprintObjs = sprintObjs;
        issue.milestones({state: StoryMap.githubStates['CLOSED']}, function(err, sprintObjs) {
          var closedSprintObjs = sprintObjs;
          var allSprintObjs = closedSprintObjs.concat(openSprintObjs).sort(StoryMap.__compareSprints);
          for (var i = 0; i < allSprintObjs.length; i++) {
            var sprint = allSprintObjs[i];
            StoryMap.sprintsList.push(StoryMap.__createSprint(sprint));
          }
          StoryMap.sprintsList.push({name:'backlog', id:-1});
          dfd.resolve();
        });
      });
      return dfd.promise();
    },
    /**
      Retrieve the list of stories for a repository
      @method __populateStoriesList
      @summary Retrieve the list of stories for a repository.
      @param {Github.issue} Github issue namespace.
      @returns {Deferred} Promise for when the stories have been retrieved 
      @memberof StoryMap 
    */
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
    /**
      Retrieve the list of states for a repository by looking through its labels
      @method __populateStateList
      @summary Retrieve the list of states for a repository by looking through its labels.
      @param {Array} Array of GitHub labels
      @memberof StoryMap 
    */
    __populateStateList: function(labels) {
      for (var i = 0; i < labels.length; ++i) {
        var label = labels[i];
        if (label.name == StoryMap.labels.IN_PROGRESS) {
          StoryMap.states.push({state:StoryMap.labels.IN_PROGRESS, verb:'In progress', color:label.color});
        } else if (label.name == StoryMap.labels.BLOCKED) {
          StoryMap.states.push({state:StoryMap.labels.BLOCKED, verb:'Blocked', color:label.color});
        }
      }
    },
    /**
      Convert a list of GitHub issue JSON objects to StoryMap story objects, and cache them
      @method __addStoriesToList
      @summary Convert a list of GitHub issue JSON objects to StoryMap story objects, and cache them.
      @param {Array} Array of GitHub issue JSON objects
      @memberof StoryMap 
    */
    __addStoriesToList: function(stories) {
      for (var i = 0; i < stories.length; ++i) {
        var story = stories[i];
        StoryMap.storiesList.push(StoryMap.__createStory(story));
      }
    },
    /**
      Check if an assignee is assigned to a story in a sprint
      @method __assigneeInSprint
      @summary Check if an assignee is assigned to a story in a sprint.
      @param assignee An assignee
      @param sprint A sprint
      @returns {Boolean} True if the assignee is in the sprint, otherwise false
      @memberof StoryMap 
    */
    __assigneeInSprint: function(assignee, sprint) {
      for (var i = 0; i < sprint.assignees.length; ++i) {
        if (sprint.assignees[i].name === assignee.name) {
          return true;
        }
      }
      return false;
    },
    /**
      Return the state of a story
      @method __getStoryState
      @summary Return the state of a story.
      @param story A GitHub issue JSON object
      @returns {Object} Object containing information on the story state
      @memberof StoryMap 
    */
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
      return {state:"open", color:"5CB85C"};
    },
    /**
      Return the assignee of a story
      @method __getStoryAssignee
      @summary Return the assignee of a story.
      @param story A GitHub issue JSON object
      @returns {Object} Object containing information on the story assignee
      @memberof StoryMap 
    */
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
    /**
      Return the epic the story belongs to
      @method __getStoryEpic
      @summary Return the epic the story belongs to.
      @param story A GitHub issue JSON object
      @returns {String} The name of the epic the story belongs to
      @memberof StoryMap 
    */
    __getStoryEpic: function(story) {
      for (var i = 0; i < story.labels.length; ++i) {
        var epic = story.labels[i].name.match(StoryMap.metaRegexp);
        if (epic !== null) {
          return epic[0];
        }
      }
      return "unspecified";
    },
    /**
      Return the sprint the story belongs to
      @method __getStorySprint
      @summary Return the sprint the story belongs to.
      @param story A GitHub issue JSON object
      @returns {String} The name of the sprint the story belongs to
      @memberof StoryMap 
    */
    __getStorySprint: function(story) {
      var sprint = story.milestone;
      if (sprint !== null) {
        return sprint.title;
      }
      return "backlog";
    },
    /**
      Get the labels associated with a story
      @method __getStoryLabels
      @summary Get the labels associated with a story.
      @param story A GitHub issue JSON object
      @returns {Array} Array of labels associated with the story
      @memberof StoryMap 
    */
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
    /**
      Parse the body of a story for any metadata
      @method __parseStoryBody
      @summary Parse the body of a story for any metadata.
      @param story A GitHub issue JSON object
      @returns {Object} Object containing the parsed metadata
      @memberof StoryMap 
    */
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
    /**
      Parse the sprint description for any metadata
      @method __parseSprintDescription
      @summary Parse the sprint description for any metadata
      @param sprint A GitHub milestone JSON object
      @returns {Object} Object containing the parsed metadata
      @memberof StoryMap 
    */
    __parseSprintDescription: function(sprint) {
      var descData = {start: ""};
      var desc = sprint.description.match(StoryMap.metaRegexp);
      if (desc === null) {
        return descData;
      }
      for (var i = 0; i < desc.length; ++i) {
        var data = desc[i].split(StoryMap.metaDelimiter);
        if (data[0] == StoryMap.metadata.START) {
          descData.start = data[1];
        }
      }
      return descData;
    },
    /**
      Get the StoryMap epic object with a particular name
      @method __getEpicObject
      @summary Get the StoryMap epic object with a particular name
      @param {String} epicName A name of an epic
      @returns {Object} The StoryMap epic object
      @memberof StoryMap 
    */
    __getEpicObject: function(epicName) {
      for (var i = 0; i < StoryMap.epicsList.length; ++i) {
        if (StoryMap.epicsList[i].name == epicName) {
          return StoryMap.epicsList[i];
        }
      }
      return {};
    },
    /**
      Convert a string into a metadata string
      @method __convertToMetaDataString
      @summary Convert a string into a metadata string.
      @param {String} string The string to be converted
      @returns {String} The converted string
      @memberof StoryMap 
    */
    __convertToMetaDataString: function(string) {
      if (string === null)
        return ""
      return "[" + string + "]";
    },
    /**
      Remove all metadata from a string
      @method __removeMetaDataStrings
      @summary Remove all metadata from a string.
      @param {String} string String to clean
      @returns {String} The cleaned string
      @memberof StoryMap 
    */
     __removeMetaDataStrings: function(string) {
      if (string === null)
        return ""
      return string.replace(/\[(\w+:\s[^\]]+)]/g, "").replace(/^\r?\n|\r$/g, "");
    },
    /**
      Compare method used to order the sprints
      @method __compareSprints
      @summary Compare method used to order the sprints
      @param {Object} a The first sprint object
      @param {Object} b The second sprint object
      @returns {number} 0 if equal, -1 if less than, 1 if greater than
      @memberof StoryMap 
    */
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

})();
