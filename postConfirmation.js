'use strict';

module.exports.handler = (event, context) => {
  console.log('User confirmed: User-Pool', event.userPoolId+", UserId: " + event.userName);
  context.done(null, event);
}
