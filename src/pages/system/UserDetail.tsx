import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spin, Table, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getUser } from '../../api/users'
import type { UserListItem } from '../../types/user'
import { useI18n } from '../../i18n/useI18n'
import TrimInput from '../../components/TrimInput'

export default function UserDetail() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<UserListItem | null>(null)
  const [loading, setLoading] = useState(false)

  const loadUser = async (userId: number) => {
    setLoading(true)
    try {
      const data = await getUser(userId)
      setUser(data)
    } catch {
      message.error(t('common.msg.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUser(Number(id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, t])

  return (
    <div className="main-container">
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/system/users')}>
          {t('common.back')}
        </Button>
      </div>

      <Spin spinning={loading}>
        {user && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ borderLeft: '3px solid #1890ff', paddingLeft: 8, marginBottom: 16 }}>{t('system.user.detailSection.basic')}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ color: '#666', marginBottom: 4 }}>{t('system.user.colAccount')}</div>
                  <TrimInput value={user.username} disabled />
                </div>
                <div>
                  <div style={{ color: '#666', marginBottom: 4 }}>{t('system.user.colDisplayName')}</div>
                  <TrimInput value={user.display_name || ''} disabled />
                </div>
                <div>
                  <div style={{ color: '#666', marginBottom: 4 }}>{t('system.user.colPhone')}</div>
                  <TrimInput value={user.phone_number || ''} disabled />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ color: '#666', marginBottom: 4 }}>{t('system.user.colEmail')}</div>
                  <TrimInput value={user.email || ''} disabled />
                </div>
                <div>
                  <div style={{ color: '#666', marginBottom: 4 }}>{t('system.user.colRole')}</div>
                  <TrimInput value={user.roles?.length ? user.roles.map((role) => role.name).join(', ') : '-'} disabled />
                </div>
                <div>
                  <div style={{ color: '#666', marginBottom: 4 }}>{t('common.status')}</div>
                  <TrimInput value={user.status === 'active' ? t('common.enabled') : t('common.disabled')} disabled />
                </div>
              </div>
            </div>
            <div>
              <h4 style={{ borderLeft: '3px solid #1890ff', paddingLeft: 8, marginBottom: 16 }}>{t('system.user.detailSection.history')}</h4>
              <Table
                size="small"
                pagination={false}
                dataSource={[]}
                columns={[
                  { title: t('system.user.detail.colProcessedAt'), dataIndex: 'processedAt', key: 'processedAt', align: 'center' },
                  { title: t('system.user.detail.colProcessedBy'), dataIndex: 'processedBy', key: 'processedBy', align: 'center' },
                  { title: t('system.user.detail.colProcessedType'), dataIndex: 'processedType', key: 'processedType', align: 'center' },
                  { title: t('system.user.detail.colPreviousValue'), dataIndex: 'previousValue', key: 'previousValue', align: 'center' },
                  { title: t('system.user.detail.colUpdatedValue'), dataIndex: 'updatedValue', key: 'updatedValue', align: 'center' },
                ]}
                locale={{ emptyText: t('common.noData') }}
              />
            </div>
          </div>
        )}
      </Spin>
    </div>
  )
}
