import React, { Component } from 'react';
import Router from 'next/router';
import dynamic from 'next/dynamic';
import getConfig from 'next/config';
import { observable } from 'mobx';
import { inject, observer } from 'mobx-react';
import Axios from 'axios';
import store from 'store';

import autoBindMethods from 'class-autobind-decorator';
import { Checkbox, Col, Row, Icon } from 'antd';
import { get, isEmpty, omit, noop, padStart } from 'lodash';
import Decimal from 'decimal.js';
import cx from 'classnames';
import { Form } from '@mighty-justice/fields-ant';
import { formatMoney, pluralize } from '@mighty-justice/utils';
import SmartBool from '@mighty-justice/smart-bool';

import Alert from './common/Alert';
import Button from './common/Button';
import Loader from './common/Loader';
import Spacer from './common/Spacer';
import TinyLoader from './common/TinyLoader';

import { FAMILY_TIME_PRICE } from '../constants';

const { publicRuntimeConfig: { STRIPE_PUBLIC_KEY } } = getConfig();

const StripeForm = dynamic(
  () => import('./StripeForm'),
  { ssr: false },
);

export const discountCodeFieldSet = {
  fields: [
    { field: 'discount_code' },
  ],
  legend: 'Apply Discount',
};

// TODO: seriously, why?
const emptyFieldSet = {fields: [], legend: ''};

const termsFieldset = {
  fields: [
    {
      editComponent: (props) => (
        <div>
          <Checkbox {...omit(props, 'value')} checked={props.value}>
            I would like to share my onboarding information.
          </Checkbox>
          <small className='chk-info'>
            {/* tslint:disable-next-line max-line-length */}
            By checking the checkbox above you agree to share your onboarding information with Tufts School of Nutrition in order to help build the next generation of adventurous eaters.
          </small>
        </div>
      ),
      field: 'share_onboaring_info',
      label: '',
      type: 'checkbox',
      value: false,
    },
    {
      editProps: {
        description: (
          <>
            {/* tslint:disable-next-line max-line-length */}
            I accept the <a href='https://www.tinyorganics.com/pages/terms-and-conditions' target='_blank'>terms and conditions</a>.
          </>
        ),
      },
      field: 'terms_accept',
      label: '',
      type: 'checkbox',
      value: false,
    },
  ],
  legend: '',
};

const checkoutFieldSets = [
  termsFieldset,
  emptyFieldSet,
];

@inject('getOptions')
@autoBindMethods
@observer

class CheckoutForm extends Component <{}> {
  @observable private discountCode;
  @observable private discountMessage;
  @observable private formMessage;
  @observable private isAddingDiscount = new SmartBool();
  @observable private isLoading = new SmartBool(true);
  @observable private isSaving = new SmartBool();
  @observable private pricing: any = {};
  @observable private shopifyId: any;
  @observable private metafields: any;
  @observable private processedCharge;
  @observable private rechargeId;
  @observable private stripeToken;

  public async componentDidMount () {
    if (isEmpty(get(store.get('customerInfo'), 'shopifyCustomerInfo'))) {
      Router.push('/account-info');
      return;
    }

    const subscriptionInfo = store.get('subscriptionInfo')
      , quantity = get(subscriptionInfo, 'quantity')
      , frequency = get(subscriptionInfo, 'frequency')
      , perItemPrice = quantity === 12 ? 5.49 : 4.69
      , itemDecimal = new Decimal(perItemPrice)
      , totalPrice = itemDecimal.times(quantity).toDecimalPlaces(2).toString()
      ;

    this.pricing = {quantity, frequency, perItemPrice, totalPrice};

    // GET METAFIELDS DATA
    this.shopifyId = get(store.get('customerInfo'), 'id');
    const { data } = await Axios.get(`/customers/${this.shopifyId}/metafields`);
    this.metafields = data.metafields;

    this.isLoading.setFalse();
  }

  private stripeFormRef;

  private serializeRechargeCheckoutInfo () {
    const { frequency } = store.get('subscriptionInfo')
      , boxItems = store.get('boxItems')
      , { shopifyCustomerInfo } = store.get('customerInfo')
      , lineItems = Object.keys(boxItems).map(id => ({
          charge_interval_frequency: frequency,
          order_day_of_week: 6,
          order_interval_frequency: frequency,
          order_interval_unit: 'week',
          shopify_product_id: boxItems[id].shopify_product_id,
          quantity: boxItems[id].quantity,
          variant_id: boxItems[id].variant_id,
        }))
      ;

    if (store.get('familyTime')) {
      const familyTime = store.get('familyTime');
      lineItems.push(familyTime);
    }

    return {
      checkout: {
        discount_code: get(this.discountCode, 'code'),
        email: shopifyCustomerInfo.email,
        line_items: lineItems.filter(lineItem => lineItem.quantity),
        shipping_address: {...shopifyCustomerInfo.addresses[0], province: shopifyCustomerInfo.province},
      },
    };
  }

  private getStripeFormRef (form: any) {
    this.stripeFormRef = form;
  }

  private async onAddDiscount (model) {
    this.discountMessage = null;

    const { data } = await Axios.get(`/discounts/${model.discount_code}`);
    if (data.discounts.length) {
      this.discountCode = data.discounts[0];
      return this.discountMessage = {type: 'success', message: 'Discount successfully applied!'};
    }
    return this.discountMessage = {type: 'error', message: 'This discount code is invalid!'};
  }

  private onRemoveDiscountCode () {
    // Missing code to remove discount code here.
  }

  private async onSave (model: any) {
    if (!model.terms_accept) {
      this.formMessage = {type: 'error', message: 'Please agree to our terms and conditions.'};
      return null;
    }

    this.isSaving.setTrue();

    // Update tufts_share metafield
    if (model.share_onboaring_info) {
      this.metafields.map(async metafield => {
        if (metafield.key === 'tufts_share') {
          metafield.value = 'true';
          await Axios.put(`/customers/${this.shopifyId}/metafields/${metafield.id}`, { metafield });
        }
      });
    }

    try {
      await this.stripeFormRef.props.onSubmit({preventDefault: noop});
    }
    catch (e) {
      this.formMessage = {type: 'error', message: 'Please provide a valid payment method!'};
      this.isSaving.setFalse();
      return null;
    }

    try {
      const rechargeCheckoutData = this.serializeRechargeCheckoutInfo()
        , { rechargeId } = store.get('customerInfo')
        , familyTime = store.get('familyTime')
        , submitData = { rechargeCheckoutData, stripeToken: this.stripeToken }
        ;

      this.rechargeId = rechargeId;

      await Axios.post('/checkout/', submitData);

      if (!isEmpty(this.pricing)) {
        const {quantity, frequency, totalPrice} = this.pricing
        , familyTimeDecimal = new Decimal(get(familyTime, 'price', 0))
        , cupsTotalDecimal = new Decimal(totalPrice)
        , totalWithAddOnDecimal = cupsTotalDecimal.add(familyTimeDecimal)
        , totalDecimal = totalWithAddOnDecimal
        , discountDecimal = this.discountCode && new Decimal(this.discountCode.value).dividedBy(100)
        , discount = this.discountCode && totalDecimal.times(discountDecimal)
        ;

        const charges = await Axios.get(`/recharge-processed-charges/?customer_id=${this.rechargeId}`);
        const processedCharge = charges.data.charges[0];

        // Track purchase event for analytics (GA, Segment)
        (window as any).analytics.track('Subscription initiated', {
          revenue: processedCharge.total_price,
          pack_size: `${quantity}-pack`,
          order_frequency: frequency,
        });

        // // GA Ecommerce track order completed
        const products = [
          {
            product_id: `TSUB${quantity}${padStart(frequency, 2, '0')}`,
            name: `${quantity} Pack ${frequency} ${pluralize('Week', 's', frequency)}`,
            price: cupsTotalDecimal.toString(),
          },
        ];
        if (!isEmpty(familyTime)) {
          products.push({
            product_id: get(familyTime, 'product_id'),
            name: 'Family Time',
            price: familyTimeDecimal.toString(),
          });
        }

        const utmInfo = store.get('utmInfo');
        if (!isEmpty(utmInfo)) {
          // for utm reports
          (window as any).analytics.track(
            'Order Completed',
            {
              order_id: processedCharge.shopify_order_id,
              total: processedCharge.total_price,
              subtotal: processedCharge.subtotal_price,
              tax: processedCharge.tax_lines,
              discount: discount ? discount.toString() : 0,
              coupon: discount ? 'discount code applied' : '',
              currency: 'USD',
              products,
            },
            {
              campaign: utmInfo,
            },
          );
        }
        else {
          (window as any).analytics.track('Order Completed', {
            order_id: processedCharge.shopify_order_id,
            total: processedCharge.total_price,
            subtotal: processedCharge.subtotal_price,
            tax: processedCharge.tax_lines,
            discount: discount ? discount.toString() : 0,
            coupon: discount ? 'discount code applied' : '',
            currency: 'USD',
            products,
          });
        }
      }

      Router.push('/order-confirmation');
      return;
    }
    catch (e) {
      const charges = await Axios.get(`/recharge-processed-charges/?customer_id=${this.rechargeId}`);
      this.processedCharge = charges.data.charges[0];

      if (this.processedCharge) {
        Router.push('/order-confirmation');
      }
      else {
        this.formMessage = {
          message: 'Please ensure all of your information is entered correctly and try again, thank you!',
          type: 'error',
        };
      }

      return null;
    }
    finally {
      this.isSaving.setFalse();
    }
  }

  public handleResult ({token}: any) {
    this.stripeToken = token.id;
  }

  private afterCloseDiscountMessage () {
    this.discountMessage = null;
  }

  private afterCloseFormMessage () {
    this.formMessage = null;
  }

  private renderDiscountForm () {
    return (
      <div className='form-discount-code'>
        <Form
          onSave={this.onAddDiscount}
          fieldSets={[discountCodeFieldSet]}
          saveText='Submit code'
        >
          {this.discountMessage && (
            <Row className='message-item'>
              <Alert
                afterClose={this.afterCloseDiscountMessage}
                closable
                message={this.discountMessage.message}
                type={this.discountMessage.type}
              />
            </Row>
          )}
        </Form>
      </div>
    );
  }

  private renderDiscount () {
    if (this.discountCode) {
      return (
        <div className='discount-code'>
          Discount code:
          <div><strong>{get(this.discountCode, 'code')}</strong></div>
        </div>
      );
    }

  // disable until remove discount code is added
    // add to .discount-code
    // <div>
    //   <Button type='link' onClick={this.onRemoveDiscountCode}>
    //     <Icon type='close-circle' />Remove code
    //   </Button>
    // </div>

    return this.isAddingDiscount.isTrue
      ? this.renderDiscountForm()
      : (
        <Button type='link' onClick={this.isAddingDiscount.setTrue}>
          <Icon type='plus-circle' /> Add discount code/gift card
        </Button>
      );
  }

  public render () {
    if (isEmpty(this.pricing)) { return <Row type='flex' justify='center'><Loader/></Row>; }

    const {quantity, frequency, totalPrice} = this.pricing
      , familyTime = store.get('familyTime')
      , familyTimeDecimal = new Decimal(get(familyTime, 'price', 0))
      , cupsTotalDecimal = new Decimal(totalPrice)
      , totalWithAddOnDecimal = cupsTotalDecimal.add(familyTimeDecimal)
      , totalDecimal = totalWithAddOnDecimal
      , discountDecimal = this.discountCode && new Decimal(this.discountCode.value).dividedBy(100)
      , discount = this.discountCode && totalDecimal.times(discountDecimal)
      , totalWithDiscount = this.discountCode && totalDecimal.minus(totalDecimal.times(discountDecimal))
      , totalDisplay = formatMoney(discount ? totalWithDiscount.toString() : totalDecimal.toString())
      ;

    return (
      <Row type='flex' justify='center'>
        <Loader spinning={this.isLoading.isTrue}>
          {this.isSaving.isTrue &&
            <TinyLoader>Your order is processing??? Please do not refresh, go back, or click again.</TinyLoader>
          }
          <Spacer />
          <div className={cx({'form-saving': this.isSaving.isTrue})}>
            <Row type='flex' justify='center'>
              <h2>Finalize Your Subscription</h2>
            </Row>
            <Spacer />
            <div className='form-wrapper'>
              {totalPrice &&
                <div>
                  <Row type='flex' justify='center'>
                    <h3>Order Summary</h3>
                  </Row>
                  <Spacer small />

                  <Row type='flex' justify='space-between'>
                    <Col span={16}>
                      <p className='large'>
                        {quantity} Meals Every {frequency}{' '}{pluralize('Week', 's', frequency)}:
                      </p>
                    </Col>
                    <Col span={4}>
                      <p>{formatMoney(cupsTotalDecimal.toString())}</p>
                    </Col>
                  </Row>

                  {familyTime && (
                    <Row type='flex' justify='space-between'>
                      <Col span={16}>
                        <p className='large'>Family Time:</p>
                      </Col>
                      <Col span={4}>
                        <p>{formatMoney(FAMILY_TIME_PRICE)}</p>
                      </Col>
                    </Row>
                  )}

                  <Row type='flex' justify='space-between'>
                    <Col span={16}>
                      <p className='large'>Subtotal:</p>
                    </Col>
                    <Col span={4}>
                      <p>{formatMoney(totalDecimal.toString())}</p>
                    </Col>
                  </Row>

                  <Row type='flex' justify='space-between'>
                    <Col span={16}>
                      <p className='large'>Shipping & Handling:</p>
                    </Col>
                    <Col span={4}>
                      <p>$0.00</p>
                    </Col>
                  </Row>

                  {discount && (
                    <Row type='flex' justify='space-between'>
                      <Col span={16}>
                        <p className='large'>Discount/Gift Card{'\n'}<i>{this.discountCode.code}</i></p>
                      </Col>
                      <Col span={4}>
                        <p>{discount.toString()} ({this.discountCode.value}%)</p>
                      </Col>
                    </Row>
                  )}

                  <Row type='flex' justify='space-between'>
                    <Col span={16}>
                      <b><p className='large'>Grand Total:</p></b>
                    </Col>
                    <Col span={4}>
                      <b><p>{totalDisplay}<br/><i> + tax</i></p></b>
                    </Col>
                  </Row>

                  <Spacer small />
                  {this.renderDiscount()}
                </div>
              }
              <Spacer large />
              <Row type='flex' justify='center'>
                <h3>Payment Info</h3>
              </Row>
              <Spacer small />
              <StripeForm
                getStripeFormRef={this.getStripeFormRef}
                stripePublicKey={STRIPE_PUBLIC_KEY}
                handleResult={this.handleResult}
              />
              <Spacer large />
              <Form
                fieldSets={checkoutFieldSets}
                isLoading={this.isSaving.isTrue}
                onSave={this.onSave}
                resetOnSuccess={false}
                saveText='Place Your Order'
              >
                {this.formMessage && (
                  <div className='message-item'>
                    <Alert
                      afterClose={this.afterCloseFormMessage}
                      closable
                      message={this.formMessage.message}
                      type={this.formMessage.type}
                    />
                  </div>
                )}
              </Form>
            </div>
          </div>
        </Loader>
      </Row>
    );
  }
}

export default CheckoutForm;
