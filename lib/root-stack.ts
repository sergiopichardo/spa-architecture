import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import path = require('path');
import CloudFrontNestedStack from './cloudfront-stack';
import ObjectStorageNestedStack from './object-storage-stack';

export class RootStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const originBucketStack = new ObjectStorageNestedStack(this, 'ObjectStorageStack', {
      buildAssetsPath: path.join(__dirname, '..', 'assets', 'ui', 'out'),
    }) 
      
    const cloudFrontStack = new CloudFrontNestedStack(this, 'CloudFrontStack', {
      cloudFrontFunctionPath: path.join(__dirname, 'url-mapper.js'),
      originBucketArn: originBucketStack.originBucket.bucketArn
    });

    cloudFrontStack.addDependency(originBucketStack);
  }
}
