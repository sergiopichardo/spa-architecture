import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

interface ObjectStorageNestedStackProps extends cdk.NestedStackProps {
    buildAssetsPath: string;
}

export default class ObjectStorageNestedStack extends cdk.NestedStack {

    public originBucket: s3.IBucket;

    constructor(scope: Construct, id: string, props: ObjectStorageNestedStackProps) {
        super(scope, id, props);

        this.originBucket = this.createOriginBucket();
        this.createDeployment(props.buildAssetsPath);
    }


    createOriginBucket(): s3.IBucket {
        return new s3.Bucket(this, 'OriginBucket', {
            autoDeleteObjects: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        });
    }

    createDeployment(buildAssetsPath: string): s3deploy.BucketDeployment  {
        return new s3deploy.BucketDeployment(this, 'OriginDeployment', {
            sources: [s3deploy.Source.asset(buildAssetsPath)],
            destinationBucket: this.originBucket,
        })
    }
}