import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import path = require('path');
import { ObjectStorageNestedStack } from './object-storage-stack';

export class RootStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new ObjectStorageNestedStack(this, 'ObjectStorage', {
      buildAssetsPath: path.join(__dirname, '..', 'assets', 'ui', 'out')
    });
  }
}
