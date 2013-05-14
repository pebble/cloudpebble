# -*- coding: utf-8 -*-
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding field 'BuildResult.total_size'
        db.add_column(u'ide_buildresult', 'total_size',
                      self.gf('django.db.models.fields.IntegerField')(null=True, blank=True),
                      keep_default=False)

        # Adding field 'BuildResult.binary_size'
        db.add_column(u'ide_buildresult', 'binary_size',
                      self.gf('django.db.models.fields.IntegerField')(null=True, blank=True),
                      keep_default=False)

        # Adding field 'BuildResult.resource_size'
        db.add_column(u'ide_buildresult', 'resource_size',
                      self.gf('django.db.models.fields.IntegerField')(null=True, blank=True),
                      keep_default=False)


    def backwards(self, orm):
        # Deleting field 'BuildResult.total_size'
        db.delete_column(u'ide_buildresult', 'total_size')

        # Deleting field 'BuildResult.binary_size'
        db.delete_column(u'ide_buildresult', 'binary_size')

        # Deleting field 'BuildResult.resource_size'
        db.delete_column(u'ide_buildresult', 'resource_size')


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
            'groups': ('django.db.models.fields.related.ManyToManyField', [], {'to': u"orm['auth.Group']", 'symmetrical': 'False', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'is_staff': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_superuser': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'last_login': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'last_name': ('django.db.models.fields.CharField', [], {'max_length': '30', 'blank': 'True'}),
            'password': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'user_permissions': ('django.db.models.fields.related.ManyToManyField', [], {'to': u"orm['auth.Permission']", 'symmetrical': 'False', 'blank': 'True'}),
            'username': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '30'})
        },
        u'contenttypes.contenttype': {
            'Meta': {'ordering': "('name',)", 'unique_together': "(('app_label', 'model'),)", 'object_name': 'ContentType', 'db_table': "'django_content_type'"},
            'app_label': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'model': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '100'})
        },
        u'ide.buildresult': {
            'Meta': {'object_name': 'BuildResult'},
            'binary_size': ('django.db.models.fields.IntegerField', [], {'null': 'True', 'blank': 'True'}),
            'finished': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'builds'", 'to': u"orm['ide.Project']"}),
            'resource_size': ('django.db.models.fields.IntegerField', [], {'null': 'True', 'blank': 'True'}),
            'started': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'db_index': 'True', 'blank': 'True'}),
            'state': ('django.db.models.fields.IntegerField', [], {'default': '1'}),
            'total_size': ('django.db.models.fields.IntegerField', [], {'null': 'True', 'blank': 'True'}),
            'uuid': ('django.db.models.fields.CharField', [], {'default': "'8bf5c1508e8a44ac830ad715728940cf'", 'max_length': '32'})
        },
        u'ide.project': {
            'Meta': {'unique_together': "(('owner', 'name'),)", 'object_name': 'Project'},
            'github_hook_build': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'github_hook_uuid': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True', 'blank': 'True'}),
            'github_last_commit': ('django.db.models.fields.CharField', [], {'max_length': '40', 'null': 'True', 'blank': 'True'}),
            'github_last_sync': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'github_repo': ('django.db.models.fields.CharField', [], {'max_length': '100', 'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'last_modified': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50'}),
            'optimisation': ('django.db.models.fields.CharField', [], {'default': "'0'", 'max_length': '1'}),
            'owner': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['auth.User']"}),
            'version_def_name': ('django.db.models.fields.CharField', [], {'default': "'APP_RESOURCES'", 'max_length': '50'})
        },
        u'ide.resourcefile': {
            'Meta': {'unique_together': "(('project', 'file_name'),)", 'object_name': 'ResourceFile'},
            'file_name': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'kind': ('django.db.models.fields.CharField', [], {'max_length': '9'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'resources'", 'to': u"orm['ide.Project']"})
        },
        u'ide.resourceidentifier': {
            'Meta': {'unique_together': "(('resource_file', 'resource_id'),)", 'object_name': 'ResourceIdentifier'},
            'character_regex': ('django.db.models.fields.CharField', [], {'max_length': '100', 'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'resource_file': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'identifiers'", 'to': u"orm['ide.ResourceFile']"}),
            'resource_id': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'tracking': ('django.db.models.fields.IntegerField', [], {'null': 'True', 'blank': 'True'})
        },
        u'ide.sourcefile': {
            'Meta': {'unique_together': "(('project', 'file_name'),)", 'object_name': 'SourceFile'},
            'file_name': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'source_files'", 'to': u"orm['ide.Project']"})
        },
        u'ide.templateproject': {
            'Meta': {'object_name': 'TemplateProject', '_ormbases': [u'ide.Project']},
            u'project_ptr': ('django.db.models.fields.related.OneToOneField', [], {'to': u"orm['ide.Project']", 'unique': 'True', 'primary_key': 'True'}),
            'template_kind': ('django.db.models.fields.IntegerField', [], {'db_index': 'True'})
        },
        u'ide.usergithub': {
            'Meta': {'object_name': 'UserGithub'},
            'avatar': ('django.db.models.fields.CharField', [], {'max_length': '255', 'null': 'True', 'blank': 'True'}),
            'nonce': ('django.db.models.fields.CharField', [], {'max_length': '32', 'null': 'True', 'blank': 'True'}),
            'token': ('django.db.models.fields.CharField', [], {'max_length': '50', 'null': 'True', 'blank': 'True'}),
            'user': ('django.db.models.fields.related.OneToOneField', [], {'related_name': "'github'", 'unique': 'True', 'primary_key': 'True', 'to': u"orm['auth.User']"}),
            'username': ('django.db.models.fields.CharField', [], {'max_length': '50', 'null': 'True', 'blank': 'True'})
        },
        u'ide.usersettings': {
            'Meta': {'object_name': 'UserSettings'},
            'autocomplete': ('django.db.models.fields.IntegerField', [], {'default': '1'}),
            'keybinds': ('django.db.models.fields.CharField', [], {'default': "'default'", 'max_length': '20'}),
            'theme': ('django.db.models.fields.CharField', [], {'default': "'monokai'", 'max_length': '50'}),
            'user': ('django.db.models.fields.related.OneToOneField', [], {'to': u"orm['auth.User']", 'unique': 'True', 'primary_key': 'True'})
        }
    }

    complete_apps = ['ide']