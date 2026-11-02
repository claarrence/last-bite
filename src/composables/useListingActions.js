import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { useActionFeedback } from '@/composables/useActionFeedback'
import { deleteListing, updateListing } from '@/utils/listings'

// Close / reopen / delete for a listing owner, shared by the detail and My Listings pages.
export function useListingActions({ onUpdated, onDeleted }) {
  const { show: showToast } = useToast()
  const { runAction } = useActionFeedback()
  const busyId = ref(null)
  const pendingDelete = ref(null)

  async function toggleStatus(listing) {
    if (busyId.value) return
    const next = listing.status === 'open' ? 'closed' : 'open'
    busyId.value = listing.id
    try {
      const updated = await runAction(
        next === 'closed' ? 'Closing your listing…' : 'Reopening your listing…',
        () => updateListing(listing.id, { status: next }),
      )
      onUpdated(updated)
      showToast(next === 'closed' ? 'Listing closed to new bookings' : 'Listing reopened')
    } catch (err) {
      showToast(`Could not update listing: ${err.message}`, 'danger')
    } finally {
      busyId.value = null
    }
  }

  function requestDelete(listing) {
    pendingDelete.value = listing
  }

  function cancelDelete() {
    if (!busyId.value) pendingDelete.value = null
  }

  async function confirmDelete() {
    if (!pendingDelete.value || busyId.value) return
    const listing = pendingDelete.value
    busyId.value = listing.id
    try {
      await runAction('Deleting your listing…', () => deleteListing(listing))
      pendingDelete.value = null
      showToast('Listing deleted')
      onDeleted(listing)
    } catch (err) {
      showToast(err.message, 'danger')
    } finally {
      busyId.value = null
    }
  }

  return { busyId, pendingDelete, toggleStatus, requestDelete, cancelDelete, confirmDelete }
}
