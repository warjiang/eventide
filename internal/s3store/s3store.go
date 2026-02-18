package s3store

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type Config struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	Prefix          string
	UsePathStyle    bool
}

type Client struct {
	s3     *s3.Client
	bucket string
	prefix string
}

func New(ctx context.Context, cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.Endpoint) == "" {
		return nil, errors.New("endpoint is required")
	}
	if strings.TrimSpace(cfg.Region) == "" {
		return nil, errors.New("region is required")
	}
	if strings.TrimSpace(cfg.Bucket) == "" {
		return nil, errors.New("bucket is required")
	}
	if _, err := url.Parse(cfg.Endpoint); err != nil {
		return nil, err
	}

	awsCfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(cfg.Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, "")),
	)
	if err != nil {
		return nil, err
	}

	s3c := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(cfg.Endpoint)
		o.UsePathStyle = cfg.UsePathStyle
	})

	prefix := strings.Trim(cfg.Prefix, "/")
	return &Client{s3: s3c, bucket: cfg.Bucket, prefix: prefix}, nil
}

func (c *Client) Key(path string) string {
	path = strings.TrimLeft(path, "/")
	if c.prefix == "" {
		return path
	}
	return c.prefix + "/" + path
}

func (c *Client) PutObject(ctx context.Context, key string, body []byte, contentType string, contentEncoding string) error {
	if strings.TrimSpace(key) == "" {
		return errors.New("key is required")
	}
	input := &s3.PutObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
		Body:   bytes.NewReader(body),
	}
	if strings.TrimSpace(contentType) != "" {
		input.ContentType = aws.String(contentType)
	}
	if strings.TrimSpace(contentEncoding) != "" {
		input.ContentEncoding = aws.String(contentEncoding)
	}
	_, err := c.s3.PutObject(ctx, input)
	return err
}

func (c *Client) EnsureBucket(ctx context.Context) error {
	if strings.TrimSpace(c.bucket) == "" {
		return errors.New("bucket is required")
	}
	_, err := c.s3.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(c.bucket)})
	if err == nil {
		return nil
	}
	_, err = c.s3.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(c.bucket)})
	if err == nil {
		return nil
	}
	var alreadyExists *types.BucketAlreadyOwnedByYou
	if errors.As(err, &alreadyExists) {
		return nil
	}
	return fmt.Errorf("ensure bucket %s: %w", c.bucket, err)
}

func (c *Client) GetObject(ctx context.Context, key string) (io.ReadCloser, string, string, error) {
	if strings.TrimSpace(key) == "" {
		return nil, "", "", errors.New("key is required")
	}
	out, err := c.s3.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(c.bucket), Key: aws.String(key)})
	if err != nil {
		return nil, "", "", err
	}
	ct := ""
	if out.ContentType != nil {
		ct = *out.ContentType
	}
	ce := ""
	if out.ContentEncoding != nil {
		ce = *out.ContentEncoding
	}
	return out.Body, ct, ce, nil
}
