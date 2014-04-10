Story-Map
=========

https://storymap.io

##User guide##

In order to map github issues into the agile story map with sprints, features and stories a Github project is going to need some configuration.


###Sprints###

Github milestones are directly mapped to sprints, so it’s important to create milestones with sprint like durations. To do this set the due date on each milestone to when the sprint will end. You will also need to add the sprint start date in to the milestone description using the following format: **[Start: YYYY-MM-DD]**

###Issues###

Github has a very simple issue workflow open or closed, yet using the story map means we can add a few more. 
Type
Issues can be labeled as a specific type.

User Stories should use the label: **story**

Bugs should use the label: **bug**


####Workflow####

Each issue has the default open and closed states but the story map supports more.

An issue that is being worked on should use the label: **in progress**

An issue that has been blocked should use the label: **blocked**


####Cost (Story Points)####

User stories are typical estimated using story points from a predefined set.

Supported story sizes: **1, 2, 3, 5, 8, 13, 20, 40, 100**

In the issue description add: **[SP:** size **]**

####Priority####

Issues can also be assigned a priority to determine overall importance.

Supported priorities **(1, 2, 3, 4, 5)** with 1 being the highest priority and 5 the lowest

In the issue description add: **[Priority:** priority **]**

###Labels###

Github contains meta-data in the form of labels providing an extensible platform for use in the agile story map. 


####Categories/Features####

In order to group issues into categories or features special labels are used. The feature name will be the used for the label name and the label color will be used by the story map to distinguish features. 


Create an feature by creating a new label named: **[** feature name **]**


Simply add this new label on the issues that belong in this feature.

##Install guide##

###Prerequisites###

- npm is installed with Node.js 0.10.xx+
- You have ssl certs to use.

If you are using Ubuntu, do not use ```sudo apt-get install nodejs```.  It installs a very old version of Node.js, so follow instructions [here](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager#ubuntu-mint-elementary-os) to get the latest version of Node.js.

Clone the repository onto your server install all of the projects dependecies with

```
npm install 
```

###Add cert files into the server directory###

* server.key
* cert.crt
* inter.crt

###Edit config.js###

In the server diretory copy config-default.js to config.js and edit it.

``` JavaScript
config.ssl = true
config.port = 443
```

Change localhost in config.url to the server hostname

**Create a Github application**

Go to github and login
Naviagte to: Account Settings -> Applications (https://github.com/settings/applications)
Create a new developer application (Register new application)

Fill in the application registration form and **set the 'Authorization callback URL' to be this servers web hostname**

On the next screen copy two pieces of information into the config.js  

```JavaScript
config.github.client_id = 'ClIENT ID';
config.github.client_secret = 'CLIENT SECRET';
```

###Start the server###

Starting the server is simple, in the server directory run; 
```
node server
```
