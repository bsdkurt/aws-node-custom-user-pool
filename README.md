<!--
title: AWS Serverless Cognito Custom User Pool example in NodeJS
description: This example demonstrates how to create an AWS Cognito custom user pool.
layout: Doc
-->
# Serverless AWS Cognito Custom User Pool Example

This example demonstrates how to create an AWS Cognito custom user pool.

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Use-cases

As of October 2017 AWS Cloud Formation does not directly support creating Cognito user pools with UsernameAttributes or VerificationMessageTemplate. The UsernameAttributes setting may not be changed after creation. In order to create a user pool with the UsernameAttributes set, a custom resource type must be used which calls a lambda that uses the AWS api to create the pool for you. When AWS fixes these issues this will become obsolete, however it still serves as an example of how to implement a custom resource type backed by a lambda.

## Prerequisites

You will need [serverless](https://serverless.com/framework/docs/providers/aws/guide/quick-start/) and [aws-cli](https://docs.aws.amazon.com/cli/latest/userguide/installing.html) installed and [configured](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

## How to Install

```bash
serverless install -u https://github.com/bsdkurt/aws-node-custom-user-pool
cd aws-node-custom-user-pool
serverless deploy
```

## How to Test

The service includes a lambda that is configured to run as a post confirmation trigger when a new user is confirmed by Cognito. To test everything is working as expected create and confirm a user in Cognito via the aws-cli. First you will need the User Pool Id and the Pool App Client Id.

```bash
export UserPoolId=$(aws cloudformation describe-stacks --stack-name custom-user-pool-dev | grep -A 1 UserPoolId | tail -1 | cut -d'"' -f 4)
export UserPoolClientId=$(aws cloudformation describe-stacks --stack-name custom-user-pool-dev | grep -A 1 UserPoolClientId | tail -1 | cut -d'"' -f 4)
```

Then create and confirm a user. Note, please change the email address below to your email address.

```bash
aws cognito-idp sign-up --region us-east-2 --client-id ${UserPoolClientId} --username your@email.address.com --password Passw0rd! --user-attributes Name="name",Value="Your Name"
aws cognito-idp admin-confirm-sign-up --region us-east-2  --user-pool-id ${UserPoolId} --username your@email.address.com
```

The postConfirmation lambda will have executed when the user was confirmed. To verify it executed go to the AWS web console and navigate to the CloudWatch Logs for the lambda at /aws/lambda/custom-user-pool-dev-postConfirmation. There should be a log message similar to:

```
2017-09-28T13:29:18.504Z ExaMple0-a451-11e7-91f3-edc45b79707c User confirmed: User-Pool us-east-2_ExaMple00, UserId: ExAmplE0-53a5-45df-b480-96b1bb6b0b51
```

## How to Remove

```bash
serverless remove
```
