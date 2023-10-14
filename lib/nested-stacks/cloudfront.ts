import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib'; 
import * as s3 from 'aws-cdk-lib/aws-s3'; 
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'; 
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins'; 
import * as iam from 'aws-cdk-lib/aws-iam'; 
import * as acm from 'aws-cdk-lib/aws-certificatemanager'; 
import * as fs from 'fs';

interface CloudFrontNestedStackProps extends cdk.NestedStackProps {
    originBucketArn: string;
    certificate: acm.ICertificate;
    cloudFrontFunctionPath: string;
    domainName: string;
}

export default class CloudFrontNestedStack extends cdk.NestedStack {
    public distribution: cloudfront.Distribution;
    constructor(scope: Construct, id: string, props: CloudFrontNestedStackProps) {
        super(scope, id, props);

        if (!props?.originBucketArn) {
            throw new Error("The origin bucket ARN must be provided");
        }

        if (!props?.certificate) {
            throw new Error("An ACM Certificate instance must be provided");
        }
        
        if (!fs.existsSync(props.cloudFrontFunctionPath)) {
            throw new Error("A path to the CloudFront function must be provided")
        }

        const originBucket = this.importOriginBucket(props.originBucketArn);

        const oai = this.createOriginAccessIdentity();
        const oaiPrincipal = this.createOriginAccessIdentityPrincipal(oai);
        this.grantPermissionsToOriginAccessIdentityPrincipal(originBucket, oaiPrincipal);


        const urlMapperCloudFrontFunction = this.createCloudFrontFunction(props.cloudFrontFunctionPath);

        this.distribution = this.createDistribution(
            originBucket,
            oai,
            urlMapperCloudFrontFunction,
            props.certificate,
            [`${props.domainName}`, `www.${props.domainName}`]
        );

        this.createOutputs();
    }

    private importOriginBucket(bucketArn: string): s3.IBucket {
        return s3.Bucket.fromBucketArn(this, 'ImportedBucket', bucketArn)
    }

    private createOriginAccessIdentity(): cloudfront.OriginAccessIdentity {
        return new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity');
    }

    private createOriginAccessIdentityPrincipal(
        originAccessIdentity: cloudfront.OriginAccessIdentity
    ): iam.CanonicalUserPrincipal {
        return new iam.CanonicalUserPrincipal(
            originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
        );
    }

    private grantPermissionsToOriginAccessIdentityPrincipal(
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

    createCloudFrontFunction(cloudFrontFunctionPath: string) {
        return new cloudfront.Function(this, 'CloudFrontFunction', {
            code: cloudfront.FunctionCode.fromFile({ filePath: cloudFrontFunctionPath })
        });
    }

    private createDistribution(
        originBucket: s3.IBucket,
        originAccessIdentity: cloudfront.IOriginAccessIdentity,
        cloudFrontFunction: cloudfront.IFunction,
        certificate: acm.ICertificate,
        domainNames: string[]
    ) {
        return new cloudfront.Distribution(this, 'CloudFrontDistribution', {
            comment: "Single page application CloudFront distribution", 
            defaultRootObject: 'index.html',
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
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
                compress: true,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            errorResponses: [
                {
                    ttl: cdk.Duration.minutes(30),
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/404.html'
                }
            ],
            certificate: certificate,
            domainNames: domainNames
        });

    }

    createOutputs() {
        new cdk.CfnOutput(this, 'CloudFrontDistributionURL', {
            description: "CloudFront distribution URL",
            value: `https://${this.distribution.distributionDomainName}`,
        })
    }


}