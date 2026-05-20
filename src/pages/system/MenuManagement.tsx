/**
 * 菜单管理页面
 * 树形表格展示菜单，支持增删改、排序调整、启用/禁用
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Col,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { getMenuTree, createMenu, updateMenu, deleteMenu } from '../../api/menus'
import type { MenuItem, MenuCreatePayload, MenuUpdatePayload } from '../../types/menu'
import { getIcon, getAvailableIconNames } from '../../constants/iconMap'
import { useI18n } from '../../i18n/useI18n'
import TrimInput from '../../components/TrimInput'
import { useFormRules } from '../../hooks/useFormRules'
import { FORM_MAX_LENGTH } from '../../constants/form'

interface FormValues {
  parent_id: number | null
  name: string
  i18n_key: string
  path: string | null
  icon: string | null
  sort_order: number
  status: boolean
  is_external: boolean
  menu_type: string  // 'menu' | 'permission'
}

export default function MenuManagement() {
  const { t } = useI18n()
  const [form] = Form.useForm<FormValues>()
  const formRules = useFormRules()
  const [treeData, setTreeData] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<MenuItem | null>(null)
  const [iconNames] = useState(() => getAvailableIconNames())

  // 加载菜单树
  const loadTree = async () => {
    setLoading(true)
    try {
      const data = await getMenuTree()
      setTreeData(data)
    } catch (err) {
      // error handled by axios interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTree()
  }, [])

  // 构建父菜单选项（只取分组菜单，即 path 为 null 的）
  const parentOptions = useMemo(() => {
    const options: Array<{ label: string; value: number }> = []
    const walk = (items: MenuItem[]) => {
      for (const item of items) {
        // 分组菜单（无 path）可作为父菜单
        if (!item.path) {
          options.push({ label: t(item.i18n_key as Parameters<typeof t>[0]), value: item.id })
        }
        if (item.children?.length) walk(item.children)
      }
    }
    walk(treeData)
    return options
  }, [treeData, t])

  // 打开新增弹窗
  const handleAdd = (parentId?: number) => {
    setEditingRecord(null)
    form.resetFields()
    if (parentId !== undefined) {
      form.setFieldsValue({ parent_id: parentId })
      // 如果父菜单有路由路径（即页面菜单），子菜单默认为权限点
      const findParent = (items: MenuItem[], id: number): MenuItem | null => {
        for (const item of items) {
          if (item.id === id) return item
          if (item.children?.length) {
            const found = findParent(item.children, id)
            if (found) return found
          }
        }
        return null
      }
      const parent = findParent(treeData, parentId)
      if (parent?.path) {
        form.setFieldsValue({ menu_type: 'permission' })
      }
    }
    setModalOpen(true)
  }

  // 打开编辑弹窗
  const handleEdit = (record: MenuItem) => {
    setEditingRecord(record)
    form.setFieldsValue({
      parent_id: record.parent_id,
      name: record.name,
      i18n_key: record.i18n_key,
      path: record.path,
      icon: record.icon,
      sort_order: record.sort_order,
      status: record.status === 'active',
      is_external: record.is_external,
      menu_type: record.menu_type || 'menu',
    })
    setModalOpen(true)
  }

  // 删除菜单
  const handleDelete = async (id: number) => {
    try {
      await deleteMenu(id)
      message.success(t('common.msg.deleteSuccess'))
      await loadTree()
    } catch (err) {
      // error handled by axios interceptor
    }
  }

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const payload: MenuCreatePayload | MenuUpdatePayload = {
        parent_id: values.parent_id || null,
        name: values.name,
        i18n_key: values.i18n_key,
        path: values.path || null,
        icon: values.icon || null,
        sort_order: values.sort_order ?? 0,
        status: values.status ? 'active' : 'disabled',
        is_external: values.is_external ?? false,
        menu_type: values.menu_type || 'menu',
      }

      if (editingRecord) {
        await updateMenu(editingRecord.id, payload)
        message.success(t('common.msg.updateSuccess'))
      } else {
        await createMenu(payload as MenuCreatePayload)
        message.success(t('common.msg.createSuccess'))
      }

      setModalOpen(false)
      await loadTree()
    } catch (err) {
      // form validation error or API error
    } finally {
      setSubmitting(false)
    }
  }

  // 切换状态
  const handleToggleStatus = async (record: MenuItem) => {
    try {
      await updateMenu(record.id, { status: record.status === 'active' ? 'disabled' : 'active' })
      message.success(t('common.msg.updateSuccess'))
      await loadTree()
    } catch (err) {
      // error handled by axios interceptor
    }
  }

  // 列定义
  const columns: ColumnsType<MenuItem> = [
    {
      title: t('menuManagement.colName'),
      dataIndex: 'name',
      key: 'name',
      render: (_text: string, record: MenuItem) => (
        <span>
          {getIcon(record.icon)}{' '}
          {t(record.i18n_key as Parameters<typeof t>[0])}
        </span>
      ),
    },
    {
      title: t('menuManagement.colI18nKey'),
      dataIndex: 'i18n_key',
      key: 'i18n_key',
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: t('menuManagement.colPath'),
      dataIndex: 'path',
      key: 'path',
      render: (text: string | null) => text || '-',
    },
    {
      title: t('menuManagement.colIcon'),
      dataIndex: 'icon',
      key: 'icon',
      width: 200,
      render: (text: string | null) => text ? <span>{getIcon(text)} {text}</span> : '-',
    },
    {
      title: t('menuManagement.colSortOrder'),
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 100,
    },
    {
      title: t('menuManagement.colMenuType'),
      dataIndex: 'menu_type',
      key: 'menu_type',
      width: 100,
      render: (text: string) => (
        <Tag color={text === 'permission' ? 'orange' : 'blue'}>
          {text === 'permission' ? t('menuManagement.typePermission') : t('menuManagement.typeMenu')}
        </Tag>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string, record: MenuItem) => (
        <Switch
          checked={status === 'active'}
          onChange={() => handleToggleStatus(record)}
          size="small"
        />
      ),
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 140,
      render: (_: unknown, record: MenuItem) => (
        <Space size={0}>
          {record.menu_type !== 'permission' && (
            <Tooltip title={t('menuManagement.addChild')}>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => handleAdd(record.id)}
              />
            </Tooltip>
          )}
          <Tooltip title={t('common.edit')}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t('menuManagement.confirmDelete')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Tooltip title={t('common.delete')}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="main-container">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>
          {t('menuManagement.addRoot')}
        </Button>
      </div>

      <Table<MenuItem>
        columns={columns}
        dataSource={treeData}
        rowKey="id"
        loading={loading}
        pagination={false}
        defaultExpandAllRows
        size="small"
      />

      <Modal
        title={editingRecord ? t('menuManagement.editMenu') : t('menuManagement.addMenu')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={submitting}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ parent_id: null, sort_order: 0, status: true, is_external: false, menu_type: 'menu' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="parent_id" label={t('menuManagement.parentMenu')}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  placeholder={t('menuManagement.parentPlaceholder')}
                  options={parentOptions}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label={t('menuManagement.menuName')} rules={[{ required: true, message: t('common.required') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput placeholder={t('menuManagement.menuNamePlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="i18n_key" label={t('menuManagement.i18nKey')} rules={[{ required: true, message: t('common.required') }, formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput placeholder={t('menuManagement.i18nKeyPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="path" label={t('menuManagement.routePath')} rules={[formRules.maxLength(FORM_MAX_LENGTH.INPUT)]}>
                <TrimInput placeholder={t('menuManagement.routePathPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="icon" label={t('menuManagement.icon')}>
                <Select
                  allowClear
                  showSearch
                  placeholder={t('menuManagement.iconPlaceholder')}
                  options={iconNames.map((name) => ({
                    label: (
                      <span>
                        {getIcon(name)} {name}
                      </span>
                    ),
                    value: name,
                  }))}
                  optionFilterProp="value"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sort_order" label={t('menuManagement.sortOrder')}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="menu_type" label={t('menuManagement.colMenuType')}>
                <Select showSearch optionFilterProp="label">
                  <Select.Option value="menu">{t('menuManagement.typeMenu')}</Select.Option>
                  <Select.Option value="permission">{t('menuManagement.typePermission')}</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label={t('common.status')} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_external" label={t('menuManagement.isExternal')} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
