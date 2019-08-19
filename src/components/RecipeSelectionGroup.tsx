import React from 'react';
import { Col, Row, Spin } from 'antd';
import { observable } from 'mobx';
import { observer } from 'mobx-react';
import Axios from 'axios';
import { chunk, fill, find } from 'lodash';
import autoBindMethods from 'class-autobind-decorator';

import ItemSelector from './ItemSelector';
import SmartBool from '@mighty-justice/smart-bool';
import AddOnStatic from './AddOnStatic';

@autoBindMethods
@observer
class RecipeSelectionGroup extends React.Component <{}> {
  @observable private data: any = [];
  @observable public total = 0;
  @observable private isLoading = new SmartBool(true);

  public async componentDidMount () {
    const response = await Axios.get('/collections/with-products/');

    // *************************************************************
    // testing the recharge and admin API's the following will be removed
    Axios.get('/orders/');
    Axios.get('/recharge-customers/');
    // *************************************************************

    this.data = find(response.data, { handle: 'menu' }).products;
    this.isLoading.setFalse();
  }

  private onChange (value: number) { this.total += value; }

  private getRowItems (rowItems) {
    const length = rowItems.length;
    if (length === 4) { return rowItems; }
    return fill(rowItems.concat(new Array(4 - rowItems.length)), null, length, 4);
  }

  public render () {
    if (this.isLoading.isTrue) {
      return (
        <Row type='flex' justify='center'>
          <Spin size='large' />
        </Row>
      );
    }

    return (
      <div>
        <Row type='flex' justify='center'>
          <h2>Select Recipes</h2>
        </Row>

        <Row type='flex' justify='center'>
          <p>{this.total} / 12 selected</p>
        </Row>

        <div>
          {chunk(this.data, 4).map((rowItems: any, idx: number) => (
              <Row type='flex' justify='space-around' align='top' key={idx} gutter={16}>
                {this.getRowItems(rowItems).map((rowItem: any, itemIdx: number) => {
                  if (!rowItem) { return <Col key={itemIdx}><div style={{height: 100, width: 100}} /></Col>; }

                  const src = rowItem.images.length && rowItem.images[0].src;
                  return (
                    <Col key={itemIdx}>
                      <ItemSelector
                        name={rowItem.title}
                        description={rowItem.description}
                        image={src}
                        onChange={this.onChange}
                      />
                    </Col>
                  );
                })}
              </Row>
            ))
          }
        </div>
        <AddOnStatic />
      </div>
    );
  }
}

export default RecipeSelectionGroup;