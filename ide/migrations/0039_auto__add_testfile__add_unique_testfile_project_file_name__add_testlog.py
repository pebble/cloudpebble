# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding model 'TestFile'
        db.create_table(u'ide_testfile', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('last_modified', self.gf('django.db.models.fields.DateTimeField')(auto_now=True, null=True, blank=True)),
            ('folded_lines', self.gf('django.db.models.fields.TextField')(default='[]')),
            ('file_name', self.gf('django.db.models.fields.CharField')(max_length=100)),
            ('project', self.gf('django.db.models.fields.related.ForeignKey')(related_name='test_files', to=orm['ide.Project'])),
        ))
        db.send_create_signal('ide', ['TestFile'])

        # Adding unique constraint on 'TestFile', fields ['project', 'file_name']
        db.create_unique(u'ide_testfile', ['project_id', 'file_name'])

        # Adding model 'TestLog'
        db.create_table(u'ide_testlog', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('test_run', self.gf('django.db.models.fields.related.OneToOneField')(related_name='logfile', unique=True, to=orm['ide.TestRun'])),
        ))
        db.send_create_signal('ide', ['TestLog'])

        # Adding model 'TestRun'
        db.create_table(u'ide_testrun', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('session', self.gf('django.db.models.fields.related.ForeignKey')(related_name='runs', to=orm['ide.TestSession'])),
            ('test', self.gf('django.db.models.fields.related.ForeignKey')(related_name='runs', null=True, on_delete=models.SET_NULL, to=orm['ide.TestFile'])),
            ('date_started', self.gf('django.db.models.fields.DateTimeField')(null=True)),
            ('date_completed', self.gf('django.db.models.fields.DateTimeField')(null=True)),
            ('original_name', self.gf('django.db.models.fields.CharField')(max_length=100)),
            ('code', self.gf('django.db.models.fields.IntegerField')(default=0)),
        ))
        db.send_create_signal('ide', ['TestRun'])

        # Adding unique constraint on 'TestRun', fields ['test', 'session']
        db.create_unique(u'ide_testrun', ['test_id', 'session_id'])

        # Adding model 'ScreenshotSet'
        db.create_table(u'ide_screenshotset', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('test', self.gf('django.db.models.fields.related.ForeignKey')(related_name='screenshot_sets', to=orm['ide.TestFile'])),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=100)),
        ))
        db.send_create_signal('ide', ['ScreenshotSet'])

        # Adding model 'ScreenshotFile'
        db.create_table(u'ide_screenshotfile', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('screenshot_set', self.gf('django.db.models.fields.related.ForeignKey')(related_name='files', to=orm['ide.ScreenshotSet'])),
            ('platform', self.gf('django.db.models.fields.CharField')(max_length=10)),
        ))
        db.send_create_signal('ide', ['ScreenshotFile'])

        # Adding unique constraint on 'ScreenshotFile', fields ['platform', 'screenshot_set']
        db.create_unique(u'ide_screenshotfile', ['platform', 'screenshot_set_id'])

        # Adding model 'TestSession'
        db.create_table(u'ide_testsession', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('date_added', self.gf('django.db.models.fields.DateTimeField')(auto_now_add=True, blank=True)),
            ('date_started', self.gf('django.db.models.fields.DateTimeField')(null=True)),
            ('date_completed', self.gf('django.db.models.fields.DateTimeField')(null=True)),
            ('project', self.gf('django.db.models.fields.related.ForeignKey')(related_name='test_sessions', to=orm['ide.Project'])),
        ))
        db.send_create_signal('ide', ['TestSession'])


    def backwards(self, orm):
        # Removing unique constraint on 'ScreenshotFile', fields ['platform', 'screenshot_set']
        db.delete_unique(u'ide_screenshotfile', ['platform', 'screenshot_set_id'])

        # Removing unique constraint on 'TestRun', fields ['test', 'session']
        db.delete_unique(u'ide_testrun', ['test_id', 'session_id'])

        # Removing unique constraint on 'TestFile', fields ['project', 'file_name']
        db.delete_unique(u'ide_testfile', ['project_id', 'file_name'])

        # Deleting model 'TestFile'
        db.delete_table(u'ide_testfile')

        # Deleting model 'TestLog'
        db.delete_table(u'ide_testlog')

        # Deleting model 'TestRun'
        db.delete_table(u'ide_testrun')

        # Deleting model 'ScreenshotSet'
        db.delete_table(u'ide_screenshotset')

        # Deleting model 'ScreenshotFile'
        db.delete_table(u'ide_screenshotfile')

        # Deleting model 'TestSession'
        db.delete_table(u'ide_testsession')


    models = {
        u'auth.group': {
            'Meta': {'object_name': 'Group'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '80'}),
            'permissions': ('django.db.models.fields.related.ManyToManyField', [], {'to': u"orm['auth.Permission']", 'symmetrical': 'False', 'blank': 'True'})
        },
        u'auth.permission': {
            'Meta': {'ordering': "(u'content_type__app_label', u'content_type__model', u'codename')", 'unique_together': "((u'content_type', u'codename'),)", 'object_name': 'Permission'},
            'codename': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'content_type': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['contenttypes.ContentType']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50'})
        },
        u'auth.user': {
            'Meta': {'object_name': 'User'},
            'date_joined': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'blank': 'True'}),
            'first_name': ('django.db.models.fields.CharField', [], {'max_length': '30', 'blank': 'True'}),
            'groups': ('django.db.models.fields.related.ManyToManyField', [], {'symmetrical': 'False', 'related_name': "u'user_set'", 'blank': 'True', 'to': u"orm['auth.Group']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'is_staff': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_superuser': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'last_login': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'last_name': ('django.db.models.fields.CharField', [], {'max_length': '30', 'blank': 'True'}),
            'password': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'user_permissions': ('django.db.models.fields.related.ManyToManyField', [], {'symmetrical': 'False', 'related_name': "u'user_set'", 'blank': 'True', 'to': u"orm['auth.Permission']"}),
            'username': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '30'})
        },
        u'contenttypes.contenttype': {
            'Meta': {'ordering': "('name',)", 'unique_together': "(('app_label', 'model'),)", 'object_name': 'ContentType', 'db_table': "'django_content_type'"},
            'app_label': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'model': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '100'})
        },
        'ide.buildresult': {
            'Meta': {'object_name': 'BuildResult'},
            'finished': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'builds'", 'to': "orm['ide.Project']"}),
            'started': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'db_index': 'True', 'blank': 'True'}),
            'state': ('django.db.models.fields.IntegerField', [], {'default': '1'}),
            'uuid': ('django.db.models.fields.CharField', [], {'default': "'0db2f6af-14ee-44ea-b889-eae03ba67724'", 'max_length': '36'})
        },
        'ide.buildsize': {
            'Meta': {'object_name': 'BuildSize'},
            'binary_size': ('django.db.models.fields.IntegerField', [], {'null': 'True', 'blank': 'True'}),
            'build': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'sizes'", 'to': "orm['ide.BuildResult']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '20'}),
            'resource_size': ('django.db.models.fields.IntegerField', [], {'null': 'True', 'blank': 'True'}),
            'total_size': ('django.db.models.fields.IntegerField', [], {'null': 'True', 'blank': 'True'}),
            'worker_size': ('django.db.models.fields.IntegerField', [], {'null': 'True', 'blank': 'True'})
        },
        'ide.project': {
            'Meta': {'object_name': 'Project'},
            'app_capabilities': ('django.db.models.fields.CharField', [], {'max_length': '255', 'null': 'True', 'blank': 'True'}),
            'app_company_name': ('django.db.models.fields.CharField', [], {'max_length': '100', 'null': 'True', 'blank': 'True'}),
            'app_is_hidden': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'app_is_shown_on_communication': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'app_is_watchface': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'app_jshint': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'app_keys': ('django.db.models.fields.TextField', [], {'default': "'{}'"}),
            'app_long_name': ('django.db.models.fields.CharField', [], {'max_length': '100', 'null': 'True', 'blank': 'True'}),
            'app_platforms': ('django.db.models.fields.TextField', [], {'max_length': '255', 'null': 'True', 'blank': 'True'}),
            'app_short_name': ('django.db.models.fields.CharField', [], {'max_length': '100', 'null': 'True', 'blank': 'True'}),
            'app_uuid': ('django.db.models.fields.CharField', [], {'default': "'4d5cfc60-ef56-4f6e-8049-fa027ffaeb77'", 'max_length': '36', 'null': 'True', 'blank': 'True'}),
            'app_version_label': ('django.db.models.fields.CharField', [], {'default': "'1.0'", 'max_length': '40', 'null': 'True', 'blank': 'True'}),
            'github_branch': ('django.db.models.fields.CharField', [], {'max_length': '100', 'null': 'True', 'blank': 'True'}),
            'github_hook_build': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'github_hook_uuid': ('django.db.models.fields.CharField', [], {'max_length': '36', 'null': 'True', 'blank': 'True'}),
            'github_last_commit': ('django.db.models.fields.CharField', [], {'max_length': '40', 'null': 'True', 'blank': 'True'}),
            'github_last_sync': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'github_repo': ('django.db.models.fields.CharField', [], {'max_length': '100', 'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'last_modified': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50'}),
            'optimisation': ('django.db.models.fields.CharField', [], {'default': "'s'", 'max_length': '1'}),
            'owner': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['auth.User']"}),
            'project_type': ('django.db.models.fields.CharField', [], {'default': "'native'", 'max_length': '10'}),
            'sdk_version': ('django.db.models.fields.CharField', [], {'default': "'2'", 'max_length': '6'})
        },
        'ide.resourcefile': {
            'Meta': {'unique_together': "(('project', 'file_name'),)", 'object_name': 'ResourceFile'},
            'file_name': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_menu_icon': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'kind': ('django.db.models.fields.CharField', [], {'max_length': '9'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'resources'", 'to': "orm['ide.Project']"}),
            'target_platforms': ('django.db.models.fields.CharField', [], {'default': 'None', 'max_length': '30', 'null': 'True', 'blank': 'True'})
        },
        'ide.resourceidentifier': {
            'Meta': {'unique_together': "(('resource_file', 'resource_id'),)", 'object_name': 'ResourceIdentifier'},
            'character_regex': ('django.db.models.fields.CharField', [], {'max_length': '100', 'null': 'True', 'blank': 'True'}),
            'compatibility': ('django.db.models.fields.CharField', [], {'max_length': '10', 'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'resource_file': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'identifiers'", 'to': "orm['ide.ResourceFile']"}),
            'resource_id': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'tracking': ('django.db.models.fields.IntegerField', [], {'null': 'True', 'blank': 'True'})
        },
        'ide.resourcevariant': {
            'Meta': {'unique_together': "(('resource_file', 'tags'),)", 'object_name': 'ResourceVariant'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_legacy': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'resource_file': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'variants'", 'to': "orm['ide.ResourceFile']"}),
            'tags': ('django.db.models.fields.CommaSeparatedIntegerField', [], {'max_length': '50', 'blank': 'True'})
        },
        'ide.screenshotfile': {
            'Meta': {'unique_together': "(('platform', 'screenshot_set'),)", 'object_name': 'ScreenshotFile'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '10'}),
            'screenshot_set': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'files'", 'to': "orm['ide.ScreenshotSet']"})
        },
        'ide.screenshotset': {
            'Meta': {'object_name': 'ScreenshotSet'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'test': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'screenshot_sets'", 'to': "orm['ide.TestFile']"})
        },
        'ide.sourcefile': {
            'Meta': {'unique_together': "(('project', 'file_name'),)", 'object_name': 'SourceFile'},
            'file_name': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'folded_lines': ('django.db.models.fields.TextField', [], {'default': "'[]'"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'last_modified': ('django.db.models.fields.DateTimeField', [], {'auto_now': 'True', 'null': 'True', 'blank': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'source_files'", 'to': "orm['ide.Project']"}),
            'target': ('django.db.models.fields.CharField', [], {'default': "'app'", 'max_length': '10'})
        },
        'ide.templateproject': {
            'Meta': {'object_name': 'TemplateProject', '_ormbases': ['ide.Project']},
            u'project_ptr': ('django.db.models.fields.related.OneToOneField', [], {'to': "orm['ide.Project']", 'unique': 'True', 'primary_key': 'True'}),
            'template_kind': ('django.db.models.fields.IntegerField', [], {'db_index': 'True'})
        },
        'ide.testfile': {
            'Meta': {'unique_together': "(('project', 'file_name'),)", 'object_name': 'TestFile'},
            'file_name': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'folded_lines': ('django.db.models.fields.TextField', [], {'default': "'[]'"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'last_modified': ('django.db.models.fields.DateTimeField', [], {'auto_now': 'True', 'null': 'True', 'blank': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'test_files'", 'to': "orm['ide.Project']"})
        },
        'ide.testlog': {
            'Meta': {'object_name': 'TestLog'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'test_run': ('django.db.models.fields.related.OneToOneField', [], {'related_name': "'logfile'", 'unique': 'True', 'to': "orm['ide.TestRun']"})
        },
        'ide.testrun': {
            'Meta': {'unique_together': "(('test', 'session'),)", 'object_name': 'TestRun'},
            'code': ('django.db.models.fields.IntegerField', [], {'default': '0'}),
            'date_completed': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'date_started': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'original_name': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'session': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'runs'", 'to': "orm['ide.TestSession']"}),
            'test': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'runs'", 'null': 'True', 'on_delete': 'models.SET_NULL', 'to': "orm['ide.TestFile']"})
        },
        'ide.testsession': {
            'Meta': {'object_name': 'TestSession'},
            'date_added': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'}),
            'date_completed': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            'date_started': ('django.db.models.fields.DateTimeField', [], {'null': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'test_sessions'", 'to': "orm['ide.Project']"})
        },
        'ide.usergithub': {
            'Meta': {'object_name': 'UserGithub'},
            'avatar': ('django.db.models.fields.CharField', [], {'max_length': '255', 'null': 'True', 'blank': 'True'}),
            'nonce': ('django.db.models.fields.CharField', [], {'max_length': '36', 'null': 'True', 'blank': 'True'}),
            'token': ('django.db.models.fields.CharField', [], {'max_length': '50', 'null': 'True', 'blank': 'True'}),
            'user': ('django.db.models.fields.related.OneToOneField', [], {'related_name': "'github'", 'unique': 'True', 'primary_key': 'True', 'to': u"orm['auth.User']"}),
            'username': ('django.db.models.fields.CharField', [], {'max_length': '50', 'null': 'True', 'blank': 'True'})
        },
        'ide.usersettings': {
            'Meta': {'object_name': 'UserSettings'},
            'accepted_terms': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'autocomplete': ('django.db.models.fields.IntegerField', [], {'default': '1'}),
            'keybinds': ('django.db.models.fields.CharField', [], {'default': "'default'", 'max_length': '20'}),
            'tab_width': ('django.db.models.fields.PositiveSmallIntegerField', [], {'default': '2'}),
            'theme': ('django.db.models.fields.CharField', [], {'default': "'cloudpebble'", 'max_length': '50'}),
            'use_spaces': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'user': ('django.db.models.fields.related.OneToOneField', [], {'to': u"orm['auth.User']", 'unique': 'True', 'primary_key': 'True'}),
            'whats_new': ('django.db.models.fields.PositiveIntegerField', [], {'default': '18'})
        }
    }

    complete_apps = ['ide']