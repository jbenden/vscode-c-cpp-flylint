import * as chai from 'chai';
import { after } from 'mocha';
import 'mocha-cakes-2';
import * as vscode from 'vscode';

const expect = chai.expect;

Feature('Extension Test Suite', () => {
    Scenario('Test Suite', () => {

        after(() => {
            vscode.window.showInformationMessage('All tests done!');
        });

        var subject: number[];

        Given('a small list of integers', () => {
            subject = [1, 2, 3];
        })

        When('an out-of-bound access is performed', () => {})

        Then('it will return an error value of negative one', () => {
            expect(subject.indexOf(5)).to.be.eq(-1)

            expect(subject.indexOf(0)).to.be.eq(-1)
        });
    });
});
