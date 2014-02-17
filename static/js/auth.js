var 
  validState = StoryMap.cookie.__read('auth_state'),
  parameters = StoryMap.uri.__decode(),
  state = parameters.state,
  code = parameters.code;
  
if (state != 'undefined' && state === validState) {
  // Redirect to #auth
  StoryMap.cookie.__erase('auth_state');
  StoryMap.cookie.__create('auth_code', code);
  document.location.href = '/#/auth';
} else {
  document.location.href = '/';
}