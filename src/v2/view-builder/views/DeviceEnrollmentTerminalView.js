import { createButton, View, loc, internal } from 'okta';
import hbs from 'handlebars-inline-precompile';
import BaseHeader from '../internals/BaseHeader';
import HeaderBeacon from '../components/HeaderBeacon';
import BaseView from '../internals/BaseView';
import BaseForm from '../internals/BaseForm';

const ODA = 'oda';
const MDM = 'mdm';
const IOS = 'ios';
const ANDROID = 'android';

const Item = View.extend({
  tagName: 'li',
});

const { Notification } = internal.views.components;
const { Clipboard } = internal.util;

const Header = BaseHeader.extend({
  HeaderBeacon: HeaderBeacon.extend({
    getBeaconClassName: () => 'mfa-okta-verify',
  }),
  initialize () {
    const deviceEnrollment = this.options.appState.get('deviceEnrollment');
    this.enrollmentType = (deviceEnrollment.name || '').toLowerCase(); // oda/mdm
    if (this.enrollmentType === ODA) { // add HeaderBeacon only for ODA
      BaseHeader.prototype.initialize.apply(this, arguments);
    }
  },
  postRender () {
    if (this.enrollmentType === ODA) { // show HeaderBeacon only for ODA
      BaseHeader.prototype.postRender.apply(this, arguments);
    }
  },
});

const Body = BaseForm.extend({
  noButtonBar: true,

  className: 'device-enrollment',

  title () {
    return this.enrollmentType === ODA
      ? loc('enroll.title.oda', 'login')
      : loc('enroll.title.mdm', 'login');
  },

  initialize () {
    BaseForm.prototype.initialize.apply(this, arguments);
    const deviceEnrollment = this.options.appState.get('deviceEnrollment');
    this.enrollmentType = (deviceEnrollment.name || '').toLowerCase(); // oda/mdm
    switch (this.enrollmentType) {
    case ODA:
      this.add(View.extend({
        template: hbs`
          <p class="explanation">
            {{{i18n code="enroll.explanation.download" bundle="login" arguments="appStoreName"}}}
          </p>
          <p class="explanation">
            {{{i18n code="enroll.explanation.signInUrl" bundle="login" arguments="signInUrl"}}}
          </p>
          <a href="{{appStoreLink}}" target="_blank">
            <img class="store-image" src="/img/{{appStoreLogo}}" />
          </a>
        `,
        getTemplateData () {
          const templateData = {
            signInUrl: deviceEnrollment.signInUrl,
          };
          const platform = (deviceEnrollment.platform || '').toLowerCase();
          if (platform === IOS) {
            templateData.appStoreName = loc('enroll.appleStore', 'login');
            templateData.appStoreLogo = 'app-store.svg';
            templateData.appStoreLink = 'https://apps.apple.com/us/app/okta-verify/id490179405';
          }
          if (platform === ANDROID) {
            templateData.appStoreName = loc('enroll.googleStore', 'login');
            templateData.appStoreLogo = 'google-play-store.svg';
            templateData.appStoreLink = 'https://play.google.com/store/apps/details?id=com.okta.android.auth';
          }
          return templateData;
        },
      }));
      break;
    case MDM:
      this.add(View.extend({
        template: hbs`{{i18n code="enroll.explanation.mdm" bundle="login"}}`,
      }));
      this.add(View.extend({
        tagName: 'ol',
        initialize () {
          this.add(Item.extend({
            children: [
              loc('enroll.mdm.step1', 'login'),
            ],
            initialize (options) {
              const copyButton = this.add(
                createButton({
                  className: 'button',
                  title: loc('enroll.mdm.copyLink', 'login'),
                })
              );
              Clipboard.attach(copyButton, {
                text: options.appState.get('deviceEnrollment').enrollmentLink,
              }).done(() => {
                var notification = new Notification({
                  message: loc('enroll.mdm.copyLink.success', 'login'),
                  level: 'success',
                });
                this.el.prepend(notification.render().el);
                return false;
              });
            },
          }));
          this.add(Item.extend({
            template: hbs`{{i18n code="enroll.mdm.step2" bundle="login"}}`,
          }));
          this.add(Item.extend({
            template: hbs`{{{i18n code="enroll.mdm.step3" bundle="login" arguments="vendor"}}}`,
            getTemplateData () {
              return deviceEnrollment;
            },
          }));
        },
      }));
      break;
    }
  },
});

export default BaseView.extend({
  Header,
  Body,
  Footer: '', // Sign out link appears in the footer if a cancel object exists in API response
});
