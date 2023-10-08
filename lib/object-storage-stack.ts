import { Construct } from 'constructs'; 
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as fs from 'fs';

interface ObjectStorageNestedStackProps extends cdk.NestedStackProps {
    buildAssetsPath: string;
}

export default class ObjectStorageNestedStack extends cdk.NestedStack {
    public originBucket: s3.IBucket;

    constructor(scope: Construct, id: string, props: ObjectStorageNestedStackProps) {
        super(scope, id, props);

        this.originBucket = this.createOriginBucket();

        if (!fs.existsSync(props.buildAssetsPath)) {
            throw new Error("A build path to SPA static assets must be provided")
        }

        this.createDeployment(props.buildAssetsPath);
    }

    createOriginBucket() {
        return new s3.Bucket(this, 'OriginBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            publicReadAccess: false,
        });
    }
    
    createDeployment(buildAssetsPath: string) {
        new s3deploy.BucketDeployment(this, 'OriginDeployment', {
            sources: [s3deploy.Source.asset(buildAssetsPath)],
            destinationBucket: this.originBucket
        });
    }


}