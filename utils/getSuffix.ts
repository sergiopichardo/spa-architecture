import * as cdk from 'aws-cdk-lib';

/**
 * Returns the stack's randomly generated id
 * @param stack 
 * @returns string (uuid)
 */
export function getSuffixFromStack(stack: cdk.Stack) {
    const shortStackId = cdk.Fn.select(2, cdk.Fn.split('/', stack.stackId));
    const suffix = cdk.Fn.select(4, cdk.Fn.split('-', shortStackId));
    return suffix;
};