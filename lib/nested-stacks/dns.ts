import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

interface DnsNestedStackProps extends cdk.NestedStackProps {
    distribution: cloudfront.Distribution;
    domainName: string;
    hostedZoneId: string;
}

export default class DnsNestedStack extends cdk.NestedStack {

    constructor(scope: Construct, id: string, props: DnsNestedStackProps) {
        super(scope, id, props);

        if (!props.distribution) {
            throw new Error("A cloudfront distribution instance must be provided");
        }

        if (!props.domainName) {
            throw new Error("The domain name must be provided");
        }

        if (!props.hostedZoneId) {
            throw new Error("The hosted zone id must be provided");
        }

        const hostedZone = this.importHostedZone(props.hostedZoneId, props.domainName);

        this.createAliasRecord(hostedZone, props.distribution, props.domainName);
        this.createAliasRecord(hostedZone, props.distribution, `www.${props.domainName}`);
    }

    private importHostedZone(hostedZoneId: string, domainName: string) {
        return route53.HostedZone.fromHostedZoneAttributes(this, 'ImportedHostedZone', {
            hostedZoneId: hostedZoneId,
            zoneName: domainName,
        });
    }

    private createAliasRecord(
        hostedZone: route53.IHostedZone, 
        distribution: cloudfront.IDistribution,
        domainName: string,
    ): route53.ARecord {
        return new route53.ARecord(this, `SPAAliasRecord-${domainName}`, {
            zone: hostedZone,
            target: route53.RecordTarget.fromAlias(
                new route53targets.CloudFrontTarget(distribution)
            ),
            recordName: domainName,
        });
    }
}