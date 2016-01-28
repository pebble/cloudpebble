# -*- coding: utf-8 -*-
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding model 'Project'
        db.create_table(u'ide_project', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('owner', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['auth.User'])),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=50)),
            ('last_modified', self.gf('django.db.models.fields.DateTimeField')(auto_now_add=True, blank=True)),
            ('version_def_name', self.gf('django.db.models.fields.CharField')(default='APP_RESOURCES', max_length=50)),
        ))
        db.send_create_signal(u'ide', ['Project'])

        # Adding unique constraint on 'Project', fields ['owner', 'name']
        db.create_unique(u'ide_project', ['owner_id', 'name'])

        # Adding model 'TemplateProject'
        db.create_table(u'ide_templateproject', (
            (u'project_ptr', self.gf('django.db.models.fields.related.OneToOneField')(to=orm['ide.Project'], unique=True, primary_key=True)),
            ('template_kind', self.gf('django.db.models.fields.IntegerField')(db_index=True)),
        ))
        db.send_create_signal(u'ide', ['TemplateProject'])

        # Adding model 'BuildResult'
        db.create_table(u'ide_buildresult', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('project', self.gf('django.db.models.fields.related.ForeignKey')(related_name='builds', to=orm['ide.Project'])),
            ('uuid', self.gf('django.db.models.fields.CharField')(default='8277f892d4d84a69ba21c3989a02c61c', max_length=32)),
            ('state', self.gf('django.db.models.fields.IntegerField')(default=1)),
            ('started', self.gf('django.db.models.fields.DateTimeField')(auto_now_add=True, db_index=True, blank=True)),
            ('finished', self.gf('django.db.models.fields.DateTimeField')(null=True, blank=True)),
        ))
        db.send_create_signal(u'ide', ['BuildResult'])

        # Adding model 'ResourceFile'
        db.create_table(u'ide_resourcefile', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('project', self.gf('django.db.models.fields.related.ForeignKey')(related_name='resources', to=orm['ide.Project'])),
            ('file_name', self.gf('django.db.models.fields.CharField')(max_length=100)),
            ('kind', self.gf('django.db.models.fields.CharField')(max_length=9)),
        ))
        db.send_create_signal(u'ide', ['ResourceFile'])

        # Adding unique constraint on 'ResourceFile', fields ['project', 'file_name']
        db.create_unique(u'ide_resourcefile', ['project_id', 'file_name'])

        # Adding model 'ResourceIdentifier'
        db.create_table(u'ide_resourceidentifier', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('resource_file', self.gf('django.db.models.fields.related.ForeignKey')(related_name='identifiers', to=orm['ide.ResourceFile'])),
            ('resource_id', self.gf('django.db.models.fields.CharField')(max_length=100)),
            ('character_regex', self.gf('django.db.models.fields.CharField')(max_length=100, null=True, blank=True)),
        ))
        db.send_create_signal(u'ide', ['ResourceIdentifier'])

        # Adding unique constraint on 'ResourceIdentifier', fields ['resource_file', 'resource_id']
        db.create_unique(u'ide_resourceidentifier', ['resource_file_id', 'resource_id'])

        # Adding model 'SourceFile'
        db.create_table(u'ide_sourcefile', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('project', self.gf('django.db.models.fields.related.ForeignKey')(related_name='source_files', to=orm['ide.Project'])),
            ('file_name', self.gf('django.db.models.fields.CharField')(max_length=100)),
        ))
        db.send_create_signal(u'ide', ['SourceFile'])

        # Adding unique constraint on 'SourceFile', fields ['project', 'file_name']
        db.create_unique(u'ide_sourcefile', ['project_id', 'file_name'])


    def backwards(self, orm):
        # Removing unique constraint on 'SourceFile', fields ['project', 'file_name']
        db.delete_unique(u'ide_sourcefile', ['project_id', 'file_name'])

        # Removing unique constraint on 'ResourceIdentifier', fields ['resource_file', 'resource_id']
        db.delete_unique(u'ide_resourceidentifier', ['resource_file_id', 'resource_id'])

        # Removing unique constraint on 'ResourceFile', fields ['project', 'file_name']
        db.delete_unique(u'ide_resourcefile', ['project_id', 'file_name'])

        # Removing unique constraint on 'Project', fields ['owner', 'name']
        db.delete_unique(u'ide_project', ['owner_id', 'name'])

        # Deleting model 'Project'
        db.delete_table(u'ide_project')

        # Deleting model 'TemplateProject'
        db.delete_table(u'ide_templateproject')

        # Deleting model 'BuildResult'
        db.delete_table(u'ide_buildresult')

        # Deleting model 'ResourceFile'
        db.delete_table(u'ide_resourcefile')

        # Deleting model 'ResourceIdentifier'
        db.delete_table(u'ide_resourceidentifier')

        # Deleting model 'SourceFile'
        db.delete_table(u'ide_sourcefile')


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
            'finished': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'project': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "'builds'", 'to': u"orm['ide.Project']"}),
            'started': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'db_index': 'True', 'blank': 'True'}),
            'state': ('django.db.models.fields.IntegerField', [], {'default': '1'}),
            'uuid': ('django.db.models.fields.CharField', [], {'default': "'7d2901ebedec4f708e706c6424a71e73'", 'max_length': '32'})
        },
        u'ide.project': {
            'Meta': {'unique_together': "(('owner', 'name'),)", 'object_name': 'Project'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'last_modified': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50'}),
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
            'resource_id': ('django.db.models.fields.CharField', [], {'max_length': '100'})
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
        }
    }

    complete_apps = ['ide']