import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path'

import SpaNestedStack from './nested-stacks/spa-stack';
import ObjectStorageNestedStack from './nested-stacks/object-storage';
import CloudFrontNestedStack from './nested-stacks/cloudfront';
import CertificateNestedStack from './nested-stacks/certificate';

interface RootStackProps extends cdk.StackProps {
  domainName: string;
  subdomain?: string;
  hostedZoneId: string;
  certificateArn: string;
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

    if (!props?.certificateArn) {
      throw new Error("An ACM Certificate ARN must be provided");
    }

    const s3Stack = new ObjectStorageNestedStack(this, 'ObjectStorageStack', {
      buildAssetsPath: path.join(__dirname, '..', 'assets', 'ui', 'out'),
    }); 

    const certificateStack = new CertificateNestedStack(this, 'CertificateStack', {
      certificateArn: props.certificateArn
    });

    const cdnStack = new CloudFrontNestedStack(this, 'CDNStack', {
      originBucketArn: s3Stack.originBucket.bucketArn,
      certificate: certificateStack.certificate,
      cloudFrontFunctionPath: path.join(__dirname, 'nested-stacks', 'url-mapper.js'),
      domainName: props.domainName,
    });

    cdnStack.addDependency(s3Stack);
    cdnStack.addDependency(certificateStack);
  }
}
