import { Construct } from 'constructs'; 
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as fs from 'fs';


interface CloudFrontNestedStackProps extends cdk.NestedStackProps {
    originBucketArn: string;
    cloudFrontFunctionPath: string;
}

export default class CloudFrontNestedStack extends cdk.NestedStack {
    public distribution: cloudfront.IDistribution;

    constructor(scope: Construct, id: string, props: CloudFrontNestedStackProps) {
        super(scope, id, props);

        const originBucket = this.importOriginBucket(props.originBucketArn);
        const oai = this.createOriginAccessIdentity();
        const oaiPrincipal = this.createOriginAccessIdentityPrincipal(oai);
        this.grantPermissionsToOriginAccessIdentityPrincipal(originBucket, oaiPrincipal);

        if (!fs.existsSync(props.cloudFrontFunctionPath)) {
            throw new Error("A path to the CloudFront function must be provided")
        }

        const cloudFrontFunction = this.createCloudFrontFunction(props.cloudFrontFunctionPath);
        const distribution = this.createDistribution(originBucket, oai, cloudFrontFunction);

        new cdk.CfnOutput(this, 'CloudFrontDistributionURL', {
            description: "CloudFront distribution URL",
            value: `https://${distribution.distributionDomainName}`,
        })
    }

    importOriginBucket(originBucketArn: string) {
        return s3.Bucket.fromBucketArn(this, 'ImportedOriginBucket', originBucketArn);
    }

    createOriginAccessIdentity() {
        return new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity');
    }

    createOriginAccessIdentityPrincipal(originAccessIdentity: cloudfront.OriginAccessIdentity) {
        return new iam.CanonicalUserPrincipal(
            originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
        )
    }

    grantPermissionsToOriginAccessIdentityPrincipal(
        originBucket: s3.IBucket,
        originAccessIdentityPrincipal: iam.CanonicalUserPrincipal
    ) {
        // Must explicitly create and attach policy because bucket is being imported
        const policyStatement = new iam.PolicyStatement({
            sid: 's3BucketPublicRead',
            effect: iam.Effect.ALLOW,
            actions: ['s3:GetObject'],
            principals: [originAccessIdentityPrincipal],
            resources: [`${originBucket.bucketArn}/*`]
        }); 

        // Manually create or update bucket policy
        // We do this because the autoCreatePolicy property will always be false for an imported S3 bucket. 
        // https://github.com/aws/aws-cdk/blob/4c7afb827b4005e337dd4635a80a7767bcec7b11/packages/%40aws-cdk/aws-s3/lib/bucket.ts#L971
        // So, we have to either create a new Bucket policy
        // or update the existing bucket policy by adding our policy statement that grants 
        // read access to the origin access identity.
        if(!originBucket.policy) {
            const bucketPolicy = new s3.BucketPolicy(this, 'Policy', { 
                bucket: originBucket 
            });

            bucketPolicy.document.addStatements(policyStatement);
        } else {
            originBucket.policy.document.addStatements(policyStatement);
        }
  
        originBucket.addToResourcePolicy(policyStatement);
    }

    createDistribution(
        originBucket: s3.IBucket, 
        originAccessIdentity: cloudfront.IOriginAccessIdentity,
        cloudFrontFunction: cloudfront.IFunction,
    ) {
        return new cloudfront.Distribution(this, 'CloudFrontDistribution', {
            comment: "Single page application CloudFront distribution", 
            defaultRootObject: 'index.html',
            defaultBehavior: {
                origin: new cloudfrontOrigins.S3Origin(originBucket, {
                    originAccessIdentity: originAccessIdentity
                }),
                functionAssociations: [
                    {
                        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                        function: cloudFrontFunction
                    }
                ],
            },
            errorResponses: [
                {
                    ttl: cdk.Duration.seconds(300),
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/404.html'
                }
            ]
        });
    }

    createCloudFrontFunction(cloudFrontFunctionPath: string) {
        return new cloudfront.Function(this, 'CloudFrontFunction', {
            code: cloudfront.FunctionCode.fromFile({ filePath: cloudFrontFunctionPath })
        });
    }
}