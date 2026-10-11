/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { QRCodeModal, QRCodeModalProps } from './QRCodeModal';

export const ConnectPhoneModal: React.FC<QRCodeModalProps> = (props) => {
  return <QRCodeModal {...props} />;
};

export { QRCodeModal };
