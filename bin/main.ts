#!/usr/bin/env node
import 'source-map-support/register';
import * as dotenv from 'dotenv';
dotenv.config();

import * as cdk from 'aws-cdk-lib';
import { RootStack } from '../lib/root-stack';

const app = new cdk.App();
new RootStack(app, 'SPAStack', {
    domainName: process.env.DOMAIN_NAME as string,
    hostedZoneId: process.env.ROUTE_53_HOSTED_ZONE_ID as string,
    subdomain: process.env.SUBDOMAIN as string,
    certificateArn: process.env.CERTIFICATE_ARN as string,
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT, 
        region: process.env.CDK_DEFAULT_REGION,
    }
});