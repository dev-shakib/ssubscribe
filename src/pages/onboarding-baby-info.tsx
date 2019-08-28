import React from 'react';

import { Row } from 'antd';

import Layout from '../components/Layout';
import Link from 'next/link';
import Button from '../components/common/Button';
import OnboardingBabyInfoForm from '../components/OnboardingBabyInfoForm';

export default () => (
  <Layout title='Ant Design Page!'>
    <div className='page-onboarding'>
      <OnboardingBabyInfoForm />
    </div>
  </Layout>
);