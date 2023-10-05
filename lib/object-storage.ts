import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import path = require('path');

interface ObjectStorageProps extends cdk.NestedStackProps {
    buildAssetsPath: string;
}

export class ObjectStorageNestedStack extends cdk.NestedStack {
  public websiteBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props?: ObjectStorageProps) {
    super(scope, id, props);

    this.websiteBucket = this.createStaticWebsiteHostingBucket();
    this.deployStaticWebsite(this.websiteBucket, '');
  }

  createStaticWebsiteHostingBucket() {
    return new s3.Bucket(this, 'UiOriginBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });
  }

  deployStaticWebsite(websiteBucket: s3.IBucket, buildAssetsPath: string) {
    new s3deploy.BucketDeployment(this, 'UiDeployment', {
      sources: [
        s3deploy.Source.asset(
          path.join(__dirname, '..', '..', 'frontend-static-website', 'out')
        )
      ],
      destinationBucket: websiteBucket
    });
  }
}
