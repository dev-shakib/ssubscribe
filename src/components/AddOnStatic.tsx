import React, { Component } from 'react';
import { noop } from 'lodash';
import { Col, Row } from 'antd';
import SelectionButtons from './SelectionButtons';

const ADD_ON_STATIC_PHOTO = 'https://cdn.shopify.com/s/files/1/0018/4650/9667/files/family-time-banner-image.jpg?40232';

class AddOnStatic extends Component<{}> {
  public render () {
    return (
      <div className='add-on-static'>
        <Row type='flex'>
          <Col span={8} className='col-photo'>
            <div className='photo' style={{backgroundImage: `url(${ADD_ON_STATIC_PHOTO}`}} />
          </Col>
          <Col span={16}>
            <div className='info'>
              <h3>Don’t miss out on Family Time</h3>
              <p>
                Our Mommy & Me Meals come in a set of 3 8-oz containers that include one of each of the following{' '}
                recipes: Ratatouille, Give it a Chai, Coconut Curry (see ingredients below).
              </p>
              <p>
                Special introductory price: $14.99 dollars with your Tiny subscription plan
              </p>
              <SelectionButtons onChange={noop} />
            </div>
          </Col>
        </Row>
      </div>
    );
  }
}

export default AddOnStatic;
