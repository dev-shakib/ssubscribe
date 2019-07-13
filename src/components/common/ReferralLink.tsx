import React, { Component } from 'react';
import { Input, message } from 'antd';
import { observer } from 'mobx-react';
import autoBindMethods from 'class-autobind-decorator';
import Button from './Button';

const referralLink = 'https://some.link?id=123q0w98rysd0h';

if (typeof window === 'undefined') {
    global.window = {};
}

@autoBindMethods
@observer
class ReferralLink extends Component <{}> {
  private input: any;
  private onCopy (e) {
    this.input.select();
    window.document.execCommand('copy');
    e.target.focus();
    message.success('Copied!');
  }

  public renderCopyButton () {
    if (!window.document || !window.document.queryCommandSupported('copy')) { return null; }
    return (
      <Button onClick={this.onCopy}>
        Copy
      </Button>
    );
  }

  public render () {
    return (
      <Input addonAfter={this.renderCopyButton()} value={referralLink} ref={(input: any) => this.input = input} />
    );
  }
}

export default ReferralLink;
