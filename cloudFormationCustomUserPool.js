'use strict';

const AWS = require("aws-sdk");
const cognitoISP = new AWS.CognitoIdentityServiceProvider({apiVersion: '2016-04-18'});
const https = require("https");
const url = require("url");

module.exports.handler = (event, context, callback) => {
    console.log(JSON.stringify(event));

    if (event.RequestType == "Delete") {
        const params = {
            UserPoolId: event.PhysicalResourceId
        };
        
        cognitoISP.describeUserPool(params, (error, data) => {
            if (error) {
                // if describe fails then either the pool is already deleted or
                // we were provided a psudo Id from a timedout create. In either
                // case respond SUCCESS so cloud formation can complete sucessfully
                console.log("User pool already deleted: " + event.PhysicalResourceId);
                sendResponse(event, context, event.PhysicalResourceId);
            } else {
                cognitoISP.deleteUserPool(params, (error, data) => {
                    var responseData = {};
                    if (error) {
                        console.log(error, error.stack);
                        sendResponse(event, context, event.PhysicalResourceId, responseData, error);
                    } else {
                        console.log("Deleted user pool successfully: " + event.PhysicalResourceId);
                        sendResponse(event, context, event.PhysicalResourceId, responseData);
                    }
                });
            }
        });
        return;
    }
 
    var params = {};
    buildParamsFromObject(event.ResourceProperties.PoolProperties, params);
    if (event.ResourceProperties.LambdaConfig) {
        params["LambdaConfig"] = {};
        buildParamsFromObject(event.ResourceProperties.LambdaConfig, params["LambdaConfig"]);
    }
    
    if (event.RequestType == "Create") {
        cognitoISP.createUserPool(params, (error, data) => {
            var responseData = {};
            if (error) {
                console.log(error, error.stack);
                sendResponse(event, context, context.logStreamName, responseData, error);
            } else {
                var resourceId = data.UserPool.Id;
                var providerName = "cognito-idp." + event.ResourceProperties.Region + ".amazonaws.com/" + resourceId;
                responseData["Arn"] = "arn:aws:cognito-idp:" + event.ResourceProperties.Region + ":" + event.ResourceProperties.AccountId + ":userpool/" + resourceId;
                responseData["ProviderName"] = providerName;
                responseData["ProviderURL"] = "https://" + providerName;
                console.log("Successfully created user pool name: " + data.UserPool.Name + ", Id: " + resourceId);
                sendResponse(event, context, resourceId, responseData);
            }
        });
        return;
    }

    // event.RequestType == "Update"

    var resourceId = event.PhysicalResourceId;

    params["UserPoolId"] = resourceId;
    
    // these parameters may not be updated
    delete params.PoolName;
    delete params.Schema;
    delete params.UsernameAttributes;
    delete params.AliasAttributes;

    cognitoISP.updateUserPool(params, (error, data) => {
        var responseData = {};
        if (error) {
            console.log(error, error.stack);
            sendResponse(event, context, resourceId, responseData, error);
        } else {
            var providerName = "cognito-idp." + event.ResourceProperties.Region + ".amazonaws.com/" + resourceId;
            responseData["Arn"] = "arn:aws:cognito-idp:" + event.ResourceProperties.Region + ":" + event.ResourceProperties.AccountId + ":userpool/" + resourceId;
            responseData["ProviderName"] = providerName;
            responseData["ProviderURL"] = "https://" + providerName;
            console.log("Successfully updated user pool id: " + resourceId);
            sendResponse(event, context, resourceId, responseData);
        }
    });
};

function buildParamsFromArray(array, params) {
    for (var i = 0; i < array.length; i++) {
        if (array[i].constructor == Object) {
            params[i] = {};
            buildParamsFromObject(array[i], params[i]);
        } else if (array[i].constructor == Array) {
            params[i] = new Array(array[i].length);
            buildParamsFromArray(array[i], params[i]);
        } else if (array[i] == "true")
            params[i] = true;
        else if (array[i] == "false")
            params[i] = false;
        else
            params[i] = array[i];
    }
}

function buildParamsFromObject(obj, params) {
    for (var property in obj) {
        if (obj.hasOwnProperty(property)) {
            if (obj[property].constructor == Object) {
                params[property] = {};
                buildParamsFromObject(obj[property], params[property]);
            } else if (obj[property].constructor == Array) {
                params[property] = new Array(obj[property].length);
                buildParamsFromArray(obj[property], params[property]);
            } else if (obj[property] == "true")
                params[property] = true;
            else if (obj[property] == "false")
                params[property] = false;
            else
                params[property] = obj[property];
        }
    }
}

// The function below was obtained from AWS documentation on cloud formation: 
// 'Walkthrough: Looking Up Amazon Machine Image IDs'
// http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/walkthrough-custom-resources-lambda-lookup-amiids.html
// It was modifed to log the error and take the resourceId as arguments

// Send response to the pre-signed S3 URL 
function sendResponse(event, context, resourceId, responseData, error) {
    var responseStatus = "SUCCESS";
    var reasonText = "See the details in CloudWatch Log Stream: " + context.logStreamName;
    if (error) {
       responseStatus = "FAILED";
       reasonText = "FAILED with error: " + error;
    }

    var responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: reasonText,
        PhysicalResourceId: resourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: responseData
    });
 
//    console.log("RESPONSE BODY:\n", responseBody);
 
    var parsedUrl = url.parse(event.ResponseURL);
    var options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: "PUT",
        headers: {
            "content-type": "",
            "content-length": responseBody.length
        }
    };
 
//    console.log("SENDING RESPONSE...\n");
 
    var request = https.request(options, function(response) {
//        console.log("STATUS: " + response.statusCode);
//        console.log("HEADERS: " + JSON.stringify(response.headers));
        // Tell AWS Lambda that the function execution is done  
        context.done();
    });
 
    request.on("error", function(error) {
        console.log("sendResponse Error:" + error);
        // Tell AWS Lambda that the function execution is done  
        context.done();
    });
  
    // write data to request body
    request.write(responseBody);
    request.end();
}
