from dataset import create_dataloaders


def main():

    (
        train_loader,
        val_loader,
        class_weights,
        train_df,
        val_df,
    ) = create_dataloaders(
        batch_size=16,
        num_workers=0,
    )

    print()
    print("Class weights:")
    print(class_weights)

    print()
    print("Train batches:", len(train_loader))
    print("Validation batches:", len(val_loader))

    # Test one batch
    images, labels = next(iter(train_loader))

    print()
    print("Batch test")
    print("-----------------------------")
    print("Images shape:", images.shape)
    print("Labels shape:", labels.shape)
    print("Labels:", labels.tolist())

    assert images.shape[1:] == (
        3,
        224,
        224,
    )

    assert labels.ndim == 1

    assert labels.min() >= 0
    assert labels.max() <= 4

    print()
    print("DATASET TEST PASSED")


if __name__ == "__main__":
    main()