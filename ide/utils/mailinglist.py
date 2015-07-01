import logging
import mailchimp

from django.conf import settings


class MailingList(object):
    mailing_list_api = mailchimp.Mailchimp(apikey=settings.MAILCHIMP_API_KEY)
    mailing_list_id = settings.MAILCHIMP_LIST_ID

    @classmethod
    def add_user(cls, user, mailing_list_id=None):
        list_id = mailing_list_id or cls.mailing_list_id

        try:
            response = cls.mailing_list_api.lists.subscribe(list_id,
                                                            {'email': user.email},
                                                            double_optin=False,
                                                            update_existing=False,
                                                            replace_interests=False)
            logging.debug("{} was successfully subscribed to list {}".format(response['email'], list_id))
        except mailchimp.ListDoesNotExistError:
            logging.error("List {} does not exist".format(list_id))
        except mailchimp.ListAlreadySubscribedError:
            logging.info("User already subscribed to list {}".format(list_id))
        except mailchimp.Error as e:
            logging.error("An error occurred: {} - {}".format(e.__class__, e))
