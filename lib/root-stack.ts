import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import path = require('path');

import SpaNestedStack from './spa-stack/spa-stack';

interface RootStackProps extends cdk.StackProps {
  domainName: string;
  subdomain: string;
  hostedZoneId: string;
}

export class RootStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: RootStackProps) {
    super(scope, id, props);

    if (!props?.domainName) {
      throw new Error("A valid domain name must be provided");
    }

    if (!props?.hostedZoneId) {
      throw new Error("A valid route 53 hosted zone id must be provided");
    }
      
    new SpaNestedStack(this, 'CloudFrontStack', {
      cloudFrontFunctionPath: path.join(__dirname, 'url-mapper.js'),
      domainName: props.domainName,
      subdomain: props.subdomain,
      hostedZoneId: props.hostedZoneId,
      buildAssetsPath: path.join(__dirname, '..', 'assets', 'ui', 'out'),
    });
  }
}
